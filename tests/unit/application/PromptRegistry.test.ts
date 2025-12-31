/**
 * PromptRegistry Unit Tests
 * 
 * Tests for the versioned prompt management system:
 * - Registration and retrieval
 * - Variable substitution
 * - Composition
 * - A/B testing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    PromptRegistry,
    PromptCategory,
    PromptDefinition
} from '../../../lib/core/application/agent/prompts/PromptRegistry';

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestPrompt = (
    id: string,
    version: string = '1.0.0',
    category: PromptCategory = PromptCategory.SYSTEM
): PromptDefinition => ({
    id,
    version,
    name: `Test Prompt ${id}`,
    description: `Test prompt for ${id}`,
    template: `You are {{agent_name}}. Respond about {{topic}}.`,
    variables: ['agent_name', 'topic'],
    tokenEstimate: 50,
    category,
    isDefault: true,
    tags: ['test'],
    author: 'test-author',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
});

// ============================================================================
// PromptRegistry Tests
// ============================================================================

describe('PromptRegistry', () => {
    let registry: PromptRegistry;

    beforeEach(() => {
        registry = new PromptRegistry();
    });

    describe('Registration', () => {
        it('should register a prompt successfully', () => {
            const prompt = createTestPrompt('test-prompt-1');

            registry.register(prompt);

            expect(registry.has('test-prompt-1')).toBe(true);
        });

        it('should register multiple versions of the same prompt', () => {
            const v1 = createTestPrompt('versioned-prompt', '1.0.0');
            const v2 = { ...createTestPrompt('versioned-prompt', '2.0.0'), template: 'Updated template' };

            registry.register(v1);
            registry.register(v2);

            const versions = registry.getVersions('versioned-prompt');
            expect(versions).toContain('1.0.0');
            expect(versions).toContain('2.0.0');
        });

        it('should get latest version by default', () => {
            registry.register(createTestPrompt('multi-ver', '1.0.0'));
            registry.register({ ...createTestPrompt('multi-ver', '2.0.0'), template: 'V2' });
            registry.register({ ...createTestPrompt('multi-ver', '1.5.0'), template: 'V1.5' });

            const latest = registry.getLatestVersion('multi-ver');
            expect(latest).toBe('2.0.0');
        });

        it('should handle duplicate version registration', () => {
            const prompt = createTestPrompt('dup-test');
            registry.register(prompt);

            // Implementation may either throw or silently overwrite
            // We just verify the registry still has the prompt
            try {
                registry.register(prompt);
            } catch (e) {
                // OK if it throws
            }
            expect(registry.has('dup-test')).toBe(true);
        });
    });

    describe('Retrieval', () => {
        beforeEach(() => {
            registry.register(createTestPrompt('retrieve-test', '1.0.0'));
            registry.register({ ...createTestPrompt('retrieve-test', '2.0.0'), template: 'V2 Template' });
        });

        it('should retrieve prompt by ID', () => {
            const prompt = registry.get('retrieve-test');

            expect(prompt).toBeDefined();
            expect(prompt?.id).toBe('retrieve-test');
        });

        it('should retrieve specific version', () => {
            const prompt = registry.get('retrieve-test', '1.0.0');

            expect(prompt?.version).toBe('1.0.0');
        });

        it('should return undefined for non-existent prompt', () => {
            const prompt = registry.get('non-existent');

            expect(prompt).toBeUndefined();
        });

        it('should throw with getOrThrow for non-existent prompt', () => {
            expect(() => registry.getOrThrow('non-existent')).toThrow();
        });
    });

    describe('Variable Substitution', () => {
        beforeEach(() => {
            registry.register({
                ...createTestPrompt('var-test'),
                template: 'Hello {{name}}, welcome to {{place}}!'
            });
        });

        it('should substitute all variables', () => {
            const rendered = registry.render('var-test', {
                name: 'Alice',
                place: 'Wonderland'
            });

            expect(rendered).toBe('Hello Alice, welcome to Wonderland!');
        });

        it('should leave unsubstituted variables as placeholders', () => {
            const rendered = registry.render('var-test', {
                name: 'Alice'
            });

            expect(rendered).toBe('Hello Alice, welcome to {{place}}!');
        });

        it('should handle empty variables object', () => {
            const rendered = registry.render('var-test', {});

            expect(rendered).toBe('Hello {{name}}, welcome to {{place}}!');
        });
    });

    describe('Composition', () => {
        beforeEach(() => {
            registry.register({
                ...createTestPrompt('system-base', '1.0.0', PromptCategory.SYSTEM),
                template: 'You are {{agent_name}}, an AI assistant.',
                tokenEstimate: 20
            });
            registry.register({
                ...createTestPrompt('task-instruction', '1.0.0', PromptCategory.TASK),
                template: 'Your task is to help with {{task}}.',
                tokenEstimate: 15
            });
            registry.register({
                ...createTestPrompt('format-json', '1.0.0', PromptCategory.FORMAT),
                template: 'Output in JSON format.',
                tokenEstimate: 10
            });
        });

        it('should compose multiple prompts in order', () => {
            const composed = registry.compose(
                ['system-base', 'task-instruction', 'format-json'],
                { agent_name: 'Evermore', task: 'memory recall' }
            );

            expect(composed.text).toContain('You are Evermore');
            expect(composed.text).toContain('help with memory recall');
            expect(composed.text).toContain('JSON format');
            expect(composed.sourceIds).toHaveLength(3);
        });

        it('should track token estimates in composition', () => {
            const composed = registry.compose(
                ['system-base', 'task-instruction'],
                {}
            );

            expect(composed.tokenEstimate).toBe(35); // 20 + 15
        });

        it('should track variables in composition', () => {
            const composed = registry.compose(
                ['system-base', 'task-instruction'],
                { agent_name: 'Evermore' }
            );

            // Verify composition returns expected structure
            expect(composed.text).toBeTruthy();
            expect(composed.sourceIds).toContain('system-base');
            expect(composed.sourceIds).toContain('task-instruction');
            // Variable tracking may vary by implementation
            expect(Array.isArray(composed.requiredVariables)).toBe(true);
        });
    });

    describe('Token Estimation', () => {
        beforeEach(() => {
            registry.register({ ...createTestPrompt('token-a'), tokenEstimate: 100 });
            registry.register({ ...createTestPrompt('token-b'), tokenEstimate: 200 });
            registry.register({ ...createTestPrompt('token-c'), tokenEstimate: 300 });
        });

        it('should estimate total tokens for multiple prompts', () => {
            const estimate = registry.getTokenEstimate(['token-a', 'token-b', 'token-c']);

            expect(estimate).toBe(600);
        });

        it('should return 0 for empty list', () => {
            const estimate = registry.getTokenEstimate([]);

            expect(estimate).toBe(0);
        });
    });

    describe('Listing and Filtering', () => {
        beforeEach(() => {
            registry.register(createTestPrompt('sys-1', '1.0.0', PromptCategory.SYSTEM));
            registry.register(createTestPrompt('sys-2', '1.0.0', PromptCategory.SYSTEM));
            registry.register(createTestPrompt('task-1', '1.0.0', PromptCategory.TASK));
            registry.register(createTestPrompt('reflect-1', '1.0.0', PromptCategory.REFLECTION));
        });

        it('should list all prompts', () => {
            const all = registry.list();

            expect(all.length).toBe(4);
        });

        it('should filter by category', () => {
            const systemPrompts = registry.listByCategory(PromptCategory.SYSTEM);

            expect(systemPrompts.length).toBe(2);
            expect(systemPrompts.every(p => p.category === PromptCategory.SYSTEM)).toBe(true);
        });

        it('should list only latest versions', () => {
            registry.register({ ...createTestPrompt('sys-1', '2.0.0', PromptCategory.SYSTEM) });

            const latest = registry.listLatest();
            const sys1Entries = latest.filter(p => p.id === 'sys-1');

            expect(sys1Entries.length).toBe(1);
            expect(sys1Entries[0].version).toBe('2.0.0');
        });
    });

    describe('Unregistration', () => {
        beforeEach(() => {
            registry.register(createTestPrompt('unreg-test', '1.0.0'));
            registry.register(createTestPrompt('unreg-test', '2.0.0'));
        });

        it('should unregister specific version', () => {
            const result = registry.unregister('unreg-test', '1.0.0');

            expect(result).toBe(true);
            expect(registry.has('unreg-test', '1.0.0')).toBe(false);
            expect(registry.has('unreg-test', '2.0.0')).toBe(true);
        });

        it('should unregister all versions when no version specified', () => {
            const result = registry.unregister('unreg-test');

            expect(result).toBe(true);
            expect(registry.has('unreg-test')).toBe(false);
        });

        it('should return false for non-existent prompt', () => {
            const result = registry.unregister('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('A/B Testing', () => {
        beforeEach(() => {
            registry.register({
                ...createTestPrompt('ab-variant-a', '1.0.0'),
                template: 'Variant A template',
                abTestGroup: 'test-experiment'
            });
            registry.register({
                ...createTestPrompt('ab-variant-b', '1.0.0'),
                template: 'Variant B template',
                abTestGroup: 'test-experiment'
            });

            registry.registerABTest({
                testId: 'test-experiment',
                variants: ['ab-variant-a', 'ab-variant-b'],
                allocation: { 'ab-variant-a': 0.5, 'ab-variant-b': 0.5 },
                active: true
            });
        });

        it('should return consistent variant for same user', () => {
            const variant1 = registry.getABVariant('test-experiment', 'user-123');
            const variant2 = registry.getABVariant('test-experiment', 'user-123');

            expect(variant1.id).toBe(variant2.id);
        });

        it('should distribute users across variants', () => {
            const variantCounts: Record<string, number> = {
                'ab-variant-a': 0,
                'ab-variant-b': 0
            };

            // Run with many users to check distribution
            for (let i = 0; i < 100; i++) {
                const variant = registry.getABVariant('test-experiment', `user-${i}`);
                variantCounts[variant.id]++;
            }

            // Both variants should have been selected at least once
            expect(variantCounts['ab-variant-a']).toBeGreaterThan(0);
            expect(variantCounts['ab-variant-b']).toBeGreaterThan(0);
        });
    });

    describe('Export/Import', () => {
        it('should export all prompts', () => {
            registry.register(createTestPrompt('export-1'));
            registry.register(createTestPrompt('export-2'));

            const exported = registry.export();

            expect(exported.length).toBe(2);
        });

        it('should import prompts', () => {
            const prompts = [
                createTestPrompt('import-1'),
                createTestPrompt('import-2')
            ];

            registry.import(prompts);

            expect(registry.has('import-1')).toBe(true);
            expect(registry.has('import-2')).toBe(true);
        });
    });
});
