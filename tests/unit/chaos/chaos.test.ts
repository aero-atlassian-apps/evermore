/**
 * Chaos Testing Unit Tests
 * 
 * Tests for the chaos testing framework.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    ChaosController,
    chaosController,
    withChaos,
    CHAOS_SCENARIOS,
    type ChaosRule,
} from '@/lib/core/testing/chaos';

describe('ChaosController', () => {
    let controller: ChaosController;

    beforeEach(() => {
        controller = ChaosController.getInstance();
        controller.reset();
    });

    afterEach(() => {
        controller.reset();
    });

    describe('Singleton', () => {
        it('should return the same instance', () => {
            const instance1 = ChaosController.getInstance();
            const instance2 = ChaosController.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('Enable/Disable', () => {
        it('should be disabled by default (in test env)', () => {
            expect(controller.isEnabled()).toBe(false);
        });

        it('should enable chaos testing', () => {
            controller.enable();
            expect(controller.isEnabled()).toBe(true);
        });

        it('should disable chaos testing', () => {
            controller.enable();
            controller.disable();
            expect(controller.isEnabled()).toBe(false);
        });
    });

    describe('Rules Management', () => {
        const testRule: ChaosRule = {
            name: 'test-rule',
            target: 'test.*',
            failureType: 'error',
            probability: 1.0,
            enabled: true,
        };

        it('should add a rule', () => {
            controller.addRule(testRule);
            expect(controller.getRules()).toHaveLength(1);
            expect(controller.getRules()[0].name).toBe('test-rule');
        });

        it('should remove a rule', () => {
            controller.addRule(testRule);
            const removed = controller.removeRule('test-rule');
            expect(removed).toBe(true);
            expect(controller.getRules()).toHaveLength(0);
        });

        it('should clear all rules', () => {
            controller.addRule(testRule);
            controller.addRule({ ...testRule, name: 'test-rule-2' });
            controller.clearRules();
            expect(controller.getRules()).toHaveLength(0);
        });
    });

    describe('Failure Injection', () => {
        it('should not inject failure when disabled', async () => {
            controller.addRule({
                name: 'test-error',
                target: 'test.operation',
                failureType: 'error',
                probability: 1.0,
                enabled: true,
            });

            // Should not throw when disabled
            await expect(controller.maybeInjectFailure('test.operation')).resolves.toBeUndefined();
        });

        it('should inject error when enabled and rule matches', async () => {
            controller.enable();
            controller.addRule({
                name: 'test-error',
                target: 'test.operation',
                failureType: 'error',
                probability: 1.0,
                config: { errorMessage: 'Test error' },
                enabled: true,
            });

            await expect(controller.maybeInjectFailure('test.operation')).rejects.toThrow('Test error');
        });

        it('should inject latency', async () => {
            controller.enable();
            controller.addRule({
                name: 'test-latency',
                target: 'test.slow',
                failureType: 'latency',
                probability: 1.0,
                config: { latencyMs: 100 },
                enabled: true,
            });

            const start = Date.now();
            await controller.maybeInjectFailure('test.slow');
            const duration = Date.now() - start;

            expect(duration).toBeGreaterThanOrEqual(90); // Allow some variance
        });

        it('should not inject failure when probability is 0', async () => {
            controller.enable();
            controller.addRule({
                name: 'test-error',
                target: 'test.operation',
                failureType: 'error',
                probability: 0,
                enabled: true,
            });

            await expect(controller.maybeInjectFailure('test.operation')).resolves.toBeUndefined();
        });

        it('should not inject failure for non-matching targets', async () => {
            controller.enable();
            controller.addRule({
                name: 'test-error',
                target: 'other.operation',
                failureType: 'error',
                probability: 1.0,
                enabled: true,
            });

            await expect(controller.maybeInjectFailure('test.operation')).resolves.toBeUndefined();
        });

        it('should support regex targets', async () => {
            controller.enable();
            controller.addRule({
                name: 'test-regex',
                target: /test\..*/,
                failureType: 'error',
                probability: 1.0,
                config: { errorMessage: 'Regex match' },
                enabled: true,
            });

            await expect(controller.maybeInjectFailure('test.anything')).rejects.toThrow('Regex match');
        });

        it('should inject rate limit error with status code', async () => {
            controller.enable();
            controller.addRule({
                name: 'test-rate-limit',
                target: 'api.call',
                failureType: 'rate_limit',
                probability: 1.0,
                enabled: true,
            });

            try {
                await controller.maybeInjectFailure('api.call');
                expect.fail('Should have thrown');
            } catch (error: unknown) {
                expect((error as { statusCode?: number }).statusCode).toBe(429);
            }
        });
    });

    describe('Metrics', () => {
        it('should track invocations', async () => {
            controller.enable();

            await controller.maybeInjectFailure('test.a');
            await controller.maybeInjectFailure('test.b');
            await controller.maybeInjectFailure('test.c');

            const metrics = controller.getMetrics();
            expect(metrics.totalInvocations).toBe(3);
        });

        it('should track failures by type', async () => {
            controller.enable();
            controller.addRule({
                name: 'error-rule',
                target: 'test.error',
                failureType: 'error',
                probability: 1.0,
                enabled: true,
            });

            try {
                await controller.maybeInjectFailure('test.error');
            } catch {
                // Expected
            }

            const metrics = controller.getMetrics();
            expect(metrics.failuresInjected).toBe(1);
            expect(metrics.byType.error).toBe(1);
        });

        it('should reset metrics', async () => {
            controller.enable();
            await controller.maybeInjectFailure('test.a');
            controller.resetMetrics();

            const metrics = controller.getMetrics();
            expect(metrics.totalInvocations).toBe(0);
        });
    });

    describe('withChaos wrapper', () => {
        it('should wrap async functions', async () => {
            const fn = vi.fn().mockResolvedValue('result');
            const wrapped = withChaos('test.fn', fn);

            const result = await wrapped('arg1', 'arg2');
            expect(result).toBe('result');
            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should inject failure before function', async () => {
            controller.enable();
            controller.addRule({
                name: 'block-fn',
                target: 'test.blocked',
                failureType: 'error',
                probability: 1.0,
                enabled: true,
            });

            const fn = vi.fn().mockResolvedValue('result');
            const wrapped = withChaos('test.blocked', fn);

            await expect(wrapped()).rejects.toThrow('[Chaos]');
            expect(fn).not.toHaveBeenCalled();
        });
    });

    describe('Predefined Scenarios', () => {
        it('should create LLM outage scenario', () => {
            const rule = CHAOS_SCENARIOS.llmOutage();
            expect(rule.name).toBe('llm-outage');
            expect(rule.failureType).toBe('error');
            expect(rule.probability).toBe(1.0);
        });

        it('should create DB slowdown scenario with custom latency', () => {
            const rule = CHAOS_SCENARIOS.dbSlowdown(10000);
            expect(rule.name).toBe('db-slowdown');
            expect(rule.config?.latencyMs).toBe(10000);
        });

        it('should create Redis flaky scenario with custom probability', () => {
            const rule = CHAOS_SCENARIOS.redisFlaky(0.5);
            expect(rule.probability).toBe(0.5);
        });
    });
});

describe('chaosController singleton', () => {
    it('should be an instance of ChaosController', () => {
        expect(chaosController).toBeInstanceOf(ChaosController);
    });
});
