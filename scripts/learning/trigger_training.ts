#!/usr/bin/env npx ts-node
/**
 * DPO Training Trigger Script
 * 
 * 100M Roadmap - Phase 2: The Training Sprint
 * 
 * This script now leverages the AutoLearningService for unified logic.
 */

import { AutoLearningService } from '../../lib/core/application/agent/learning/AutoLearningService';

async function main() {
    console.log('='.repeat(60));
    console.log('[DPO Training Trigger] Starting at', new Date().toISOString());
    console.log('='.repeat(60));

    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const execute = args.includes('--execute');
    const deploy = args.includes('--auto-deploy');

    // Override config based on CLI args
    const service = AutoLearningService.getInstance({
        minPairs: force ? 0 : undefined, // Force triggers training regardless of threshold
        autoExecute: execute,
        autoDeploy: deploy,
    });

    const result = await service.checkAndTrigger();

    if (result.triggered) {
        console.log(`[DPO Training Trigger] Success! Job ID: ${result.jobId}`);
    } else {
        console.log(`[DPO Training Trigger] Deferred: ${result.reason}`);
    }

    console.log('='.repeat(60));
}

main().catch(error => {
    console.error('[DPO Training Trigger] ❌ Fatal error:', error);
    process.exit(1);
});
