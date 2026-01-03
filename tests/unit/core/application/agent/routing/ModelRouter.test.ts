import { describe, it, expect, afterEach } from 'vitest';
import { ModelRouter, TaskComplexity, ModelTier } from '../../../../../../lib/core/application/agent/routing/ModelRouter';
import * as fs from 'fs';
import * as path from 'path';

describe('ModelRouter Dynamic Loading', () => {
    const TEMP_REGISTRY_PATH = path.join(__dirname, 'temp_models.json');

    afterEach(() => {
        if (fs.existsSync(TEMP_REGISTRY_PATH)) {
            fs.unlinkSync(TEMP_REGISTRY_PATH);
        }
    });

    it('should load models from valid registry file', async () => {
        const router = new ModelRouter();

        const newModel = {
            id: 'test-model-1',
            name: 'Test Model',
            provider: 'test',
            tier: ModelTier.STANDARD,
            costPer1KInputTokens: 0.01,
            costPer1KOutputTokens: 0.01,
            maxContextTokens: 4096,
            maxOutputTokens: 1024,
            latencyP50Ms: 100,
            latencyP95Ms: 200,
            capabilities: [TaskComplexity.CLASSIFICATION],
            qualityScores: { [TaskComplexity.CLASSIFICATION]: 0.95 },
            available: true
        };

        fs.writeFileSync(TEMP_REGISTRY_PATH, JSON.stringify([newModel]));

        await router.loadRegistry(TEMP_REGISTRY_PATH);

        // Verify routing picks it up
        const decision = router.route(TaskComplexity.CLASSIFICATION, { preferredTier: ModelTier.STANDARD });
        expect(decision.modelId).toBe('test-model-1');
    });

    it('should handle missing registry file gracefully', async () => {
        const router = new ModelRouter();
        await router.loadRegistry('non-existent.json');
        // Should not throw
        const decision = router.route(TaskComplexity.CLASSIFICATION, {});
        expect(decision).toBeDefined();
    });
});
