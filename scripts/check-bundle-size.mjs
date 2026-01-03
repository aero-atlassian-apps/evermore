#!/usr/bin/env node

/**
 * Bundle Size Checker
 * 
 * Analyzes Next.js build output and compares against performance budgets.
 * Exits with error if budgets are exceeded.
 * 
 * Usage:
 *   node scripts/check-bundle-size.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ============================================================================
// Configuration
// ============================================================================

const BUDGET_FILE = path.join(rootDir, 'performance-budget.json');
const BUILD_MANIFEST = path.join(rootDir, '.next', 'build-manifest.json');
const APP_BUILD_MANIFEST = path.join(rootDir, '.next', 'app-build-manifest.json');
const NEXT_DIR = path.join(rootDir, '.next');

// ANSI colors for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m',
};

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes) {
    const kb = bytes / 1024;
    if (kb >= 1024) {
        return `${(kb / 1024).toFixed(2)} MB`;
    }
    return `${kb.toFixed(2)} KB`;
}

function getFileSizeRecursive(dirPath, extensions = ['.js', '.css']) {
    let totalSize = 0;

    if (!fs.existsSync(dirPath)) {
        return totalSize;
    }

    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        if (file.isDirectory()) {
            totalSize += getFileSizeRecursive(filePath, extensions);
        } else if (extensions.some(ext => file.name.endsWith(ext))) {
            totalSize += fs.statSync(filePath).size;
        }
    }

    return totalSize;
}

function loadBudget() {
    if (!fs.existsSync(BUDGET_FILE)) {
        console.log(`${colors.yellow}⚠ No performance-budget.json found, using defaults${colors.reset}`);
        return {
            budgets: {
                javascript: { maxSizeKb: 500 },
                css: { maxSizeKb: 100 },
                firstLoad: { maxSizeKb: 600 },
            },
            thresholds: {
                warningPercentage: 80,
                errorOnExceed: true,
            },
        };
    }

    return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf-8'));
}

// ============================================================================
// Analysis
// ============================================================================

function analyzeBundle() {
    console.log(`\n${colors.bold}📊 Bundle Size Analysis${colors.reset}\n`);
    console.log('='.repeat(60));

    // Check if build exists
    if (!fs.existsSync(NEXT_DIR)) {
        console.error(`${colors.red}✗ No .next build directory found. Run 'npm run build' first.${colors.reset}`);
        process.exit(1);
    }

    const budget = loadBudget();
    const results = {
        passed: true,
        warnings: [],
        errors: [],
        sizes: {},
    };

    // Analyze JavaScript bundles
    const staticDir = path.join(NEXT_DIR, 'static');
    const chunksDir = path.join(staticDir, 'chunks');

    const jsSize = getFileSizeRecursive(staticDir, ['.js']);
    const jsSizeKb = jsSize / 1024;
    results.sizes.javascript = jsSizeKb;

    console.log(`\n${colors.blue}JavaScript Bundles:${colors.reset}`);
    console.log(`  Total: ${formatBytes(jsSize)}`);

    if (budget.budgets.javascript) {
        const maxKb = budget.budgets.javascript.maxSizeKb;
        const percentage = (jsSizeKb / maxKb) * 100;

        if (jsSizeKb > maxKb) {
            results.errors.push(`JavaScript: ${formatBytes(jsSize)} exceeds budget of ${maxKb} KB`);
            results.passed = false;
            console.log(`  ${colors.red}✗ Exceeds budget: ${maxKb} KB (${percentage.toFixed(1)}%)${colors.reset}`);
        } else if (percentage >= budget.thresholds.warningPercentage) {
            results.warnings.push(`JavaScript: ${formatBytes(jsSize)} is ${percentage.toFixed(1)}% of budget`);
            console.log(`  ${colors.yellow}⚠ Warning: ${percentage.toFixed(1)}% of budget${colors.reset}`);
        } else {
            console.log(`  ${colors.green}✓ Within budget: ${percentage.toFixed(1)}%${colors.reset}`);
        }
    }

    // Analyze CSS
    const cssSize = getFileSizeRecursive(staticDir, ['.css']);
    const cssSizeKb = cssSize / 1024;
    results.sizes.css = cssSizeKb;

    console.log(`\n${colors.blue}CSS Bundles:${colors.reset}`);
    console.log(`  Total: ${formatBytes(cssSize)}`);

    if (budget.budgets.css) {
        const maxKb = budget.budgets.css.maxSizeKb;
        const percentage = (cssSizeKb / maxKb) * 100;

        if (cssSizeKb > maxKb) {
            results.errors.push(`CSS: ${formatBytes(cssSize)} exceeds budget of ${maxKb} KB`);
            results.passed = false;
            console.log(`  ${colors.red}✗ Exceeds budget: ${maxKb} KB (${percentage.toFixed(1)}%)${colors.reset}`);
        } else if (percentage >= budget.thresholds.warningPercentage) {
            results.warnings.push(`CSS: ${formatBytes(cssSize)} is ${percentage.toFixed(1)}% of budget`);
            console.log(`  ${colors.yellow}⚠ Warning: ${percentage.toFixed(1)}% of budget${colors.reset}`);
        } else {
            console.log(`  ${colors.green}✓ Within budget: ${percentage.toFixed(1)}%${colors.reset}`);
        }
    }

    // First Load Total
    const firstLoadKb = jsSizeKb + cssSizeKb;
    results.sizes.firstLoad = firstLoadKb;

    console.log(`\n${colors.blue}First Load Total:${colors.reset}`);
    console.log(`  Total: ${formatBytes((jsSizeKb + cssSizeKb) * 1024)}`);

    if (budget.budgets.firstLoad) {
        const maxKb = budget.budgets.firstLoad.maxSizeKb;
        const percentage = (firstLoadKb / maxKb) * 100;

        if (firstLoadKb > maxKb) {
            results.errors.push(`First Load: ${formatBytes(firstLoadKb * 1024)} exceeds budget of ${maxKb} KB`);
            results.passed = false;
            console.log(`  ${colors.red}✗ Exceeds budget: ${maxKb} KB (${percentage.toFixed(1)}%)${colors.reset}`);
        } else if (percentage >= budget.thresholds.warningPercentage) {
            results.warnings.push(`First Load: ${formatBytes(firstLoadKb * 1024)} is ${percentage.toFixed(1)}% of budget`);
            console.log(`  ${colors.yellow}⚠ Warning: ${percentage.toFixed(1)}% of budget${colors.reset}`);
        } else {
            console.log(`  ${colors.green}✓ Within budget: ${percentage.toFixed(1)}%${colors.reset}`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));

    if (results.errors.length > 0) {
        console.log(`\n${colors.red}${colors.bold}❌ BUDGET EXCEEDED${colors.reset}\n`);
        for (const error of results.errors) {
            console.log(`  ${colors.red}• ${error}${colors.reset}`);
        }
    }

    if (results.warnings.length > 0) {
        console.log(`\n${colors.yellow}${colors.bold}⚠ WARNINGS${colors.reset}\n`);
        for (const warning of results.warnings) {
            console.log(`  ${colors.yellow}• ${warning}${colors.reset}`);
        }
    }

    if (results.passed) {
        console.log(`\n${colors.green}${colors.bold}✅ All performance budgets passed!${colors.reset}\n`);
    }

    // Output JSON for CI consumption
    const jsonOutput = {
        passed: results.passed,
        sizes: results.sizes,
        warnings: results.warnings,
        errors: results.errors,
        timestamp: new Date().toISOString(),
    };

    // Write results to file for CI artifact
    const resultsPath = path.join(rootDir, '.next', 'bundle-analysis.json');
    fs.writeFileSync(resultsPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`📄 Results saved to: ${resultsPath}\n`);

    // Exit with error if budgets exceeded
    if (!results.passed && budget.thresholds.errorOnExceed) {
        process.exit(1);
    }

    return results;
}

// ============================================================================
// Main
// ============================================================================

try {
    analyzeBundle();
} catch (error) {
    console.error(`${colors.red}Error analyzing bundle:${colors.reset}`, error.message);
    process.exit(1);
}
