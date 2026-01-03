#!/usr/bin/env npx ts-node
/**
 * Register Model Script
 * 
 * Dynamically adds or updates a model in the system registry.
 * Used by the auto-training pipeline to deploy new DPO models.
 * 
 * Usage:
 *   npx ts-node scripts/learning/register_model.ts --id "my-model" --name "My Model" --path "/path/to/gguf"
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG_PATH = path.join(__dirname, '../../config/models.json');

// Helper to parse args
function parseArgs() {
    const args = process.argv.slice(2);
    const parsed: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
            parsed[key] = value;
        }
    }
    return parsed;
}

async function main() {
    console.log('[Register Model] Starting...');
    const args = parseArgs();

    if (!args.id) {
        console.error('❌ Missing required argument: --id');
        process.exit(1);
    }

    // Default values
    const newModel = {
        id: args.id,
        name: args.name || args.id,
        provider: args.provider || 'local', // Default to local for DPO models
        tier: (args.tier || 'PRO') as any,
        // DPO models (Unsloth/Llama3) cost estimates (running locally = cheap/free but use equivalent valid pricing for logic)
        costPer1KInputTokens: parseFloat(args.costInput || '0'),
        costPer1KOutputTokens: parseFloat(args.costOutput || '0'),
        maxContextTokens: parseInt(args.context || '8192'),
        maxOutputTokens: parseInt(args.output || '4096'),
        latencyP50Ms: parseInt(args.latency || '500'),
        latencyP95Ms: parseInt(args.latency95 || '1500'),
        capabilities: [
            'CLASSIFICATION',
            'REASONING',
            'CREATIVE',
            'SUMMARIZATION'
        ], // Default set
        qualityScores: {
            'REASONING': 0.85, // Optimistic default for fine-tuned
            'CREATIVE': 0.85
        },
        available: true,
        // Custom field for local path if needed by a LocalProviderAdapter (future)
        localPath: args.path || ''
    };

    try {
        // Load existing
        let models: any[] = [];
        if (fs.existsSync(CONFIG_PATH)) {
            models = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        } else {
            console.log('[Register Model] Creating new registry file.');
        }

        // Upsert
        const idx = models.findIndex(m => m.id === newModel.id);
        if (idx >= 0) {
            console.log(`[Register Model] Updating existing model: ${newModel.id}`);
            models[idx] = { ...models[idx], ...newModel };
        } else {
            console.log(`[Register Model] Adding new model: ${newModel.id}`);
            models.push(newModel);
        }

        // Save
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(models, null, 2));
        console.log(`[Register Model] ✅ Registry updated at ${CONFIG_PATH}`);

    } catch (error: any) {
        console.error('[Register Model] ❌ Failed to register model:', error.message);
        process.exit(1);
    }
}

main();
