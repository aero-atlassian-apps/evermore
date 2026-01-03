/**
 * Chaos Testing Framework
 * 
 * Provides utilities for resilience testing through controlled failure injection.
 * Used to validate circuit breakers, fallbacks, and graceful degradation.
 * 
 * @module chaos
 */

import { logger } from '@/lib/core/application/Logger';

// ============================================================================
// Types
// ============================================================================

export type FailureType =
    | 'timeout'
    | 'error'
    | 'latency'
    | 'partial_failure'
    | 'rate_limit'
    | 'connection_reset';

export interface ChaosRule {
    name: string;
    target: string | RegExp;
    failureType: FailureType;
    probability: number;  // 0-1
    config?: {
        latencyMs?: number;
        errorMessage?: string;
        statusCode?: number;
    };
    enabled: boolean;
}

export interface ChaosMetrics {
    totalInvocations: number;
    failuresInjected: number;
    byType: Record<FailureType, number>;
}

// ============================================================================
// Chaos Controller
// ============================================================================

/**
 * Central controller for chaos testing.
 * 
 * Usage:
 * ```typescript
 * // Enable chaos for testing
 * chaosController.enable();
 * 
 * // Add failure rules
 * chaosController.addRule({
 *   name: 'llm-timeout',
 *   target: 'llm.*',
 *   failureType: 'timeout',
 *   probability: 0.5,
 *   enabled: true,
 * });
 * 
 * // Check before operations
 * await chaosController.maybeInjectFailure('llm.generate');
 * ```
 */
export class ChaosController {
    private static instance: ChaosController;
    private enabled = false;
    private rules: Map<string, ChaosRule> = new Map();
    private metrics: ChaosMetrics = {
        totalInvocations: 0,
        failuresInjected: 0,
        byType: {
            timeout: 0,
            error: 0,
            latency: 0,
            partial_failure: 0,
            rate_limit: 0,
            connection_reset: 0,
        },
    };

    private constructor() {
        // Only enable chaos in test/development
        if (process.env.CHAOS_ENABLED === 'true') {
            this.enabled = true;
            logger.warn('[Chaos] Chaos testing ENABLED - DO NOT USE IN PRODUCTION');
        }
    }

    static getInstance(): ChaosController {
        if (!ChaosController.instance) {
            ChaosController.instance = new ChaosController();
        }
        return ChaosController.instance;
    }

    /**
     * Enable chaos testing.
     */
    enable(): void {
        this.enabled = true;
        logger.warn('[Chaos] Chaos testing enabled');
    }

    /**
     * Disable chaos testing.
     */
    disable(): void {
        this.enabled = false;
        logger.info('[Chaos] Chaos testing disabled');
    }

    /**
     * Check if chaos is enabled.
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Add a chaos rule.
     */
    addRule(rule: ChaosRule): void {
        this.rules.set(rule.name, rule);
        logger.debug('[Chaos] Rule added', { rule: rule.name, target: String(rule.target) });
    }

    /**
     * Remove a chaos rule.
     */
    removeRule(name: string): boolean {
        return this.rules.delete(name);
    }

    /**
     * Clear all rules.
     */
    clearRules(): void {
        this.rules.clear();
    }

    /**
     * Get all rules.
     */
    getRules(): ChaosRule[] {
        return Array.from(this.rules.values());
    }

    /**
     * Check if failure should be injected for a target.
     * 
     * @param target - The operation name to check (e.g., 'llm.generate', 'db.query')
     * @throws Error if failure should be injected
     * @returns Promise that may reject or delay based on rules
     */
    async maybeInjectFailure(target: string): Promise<void> {
        if (!this.enabled) {
            return;
        }

        this.metrics.totalInvocations++;

        for (const rule of this.rules.values()) {
            if (!rule.enabled) continue;

            // Check if target matches
            const matches = typeof rule.target === 'string'
                ? target === rule.target || target.startsWith(rule.target.replace('*', ''))
                : rule.target.test(target);

            if (!matches) continue;

            // Check probability
            if (Math.random() > rule.probability) continue;

            // Inject failure
            await this.injectFailure(rule);
        }
    }

    /**
     * Inject the specified failure.
     */
    private async injectFailure(rule: ChaosRule): Promise<void> {
        this.metrics.failuresInjected++;
        this.metrics.byType[rule.failureType]++;

        logger.warn('[Chaos] Injecting failure', {
            rule: rule.name,
            type: rule.failureType,
        });

        switch (rule.failureType) {
            case 'timeout':
                await new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`[Chaos] Timeout injected by rule: ${rule.name}`));
                    }, rule.config?.latencyMs || 30000);
                });
                break;

            case 'error':
                throw new Error(
                    rule.config?.errorMessage || `[Chaos] Error injected by rule: ${rule.name}`
                );

            case 'latency':
                await new Promise(resolve => {
                    setTimeout(resolve, rule.config?.latencyMs || 2000);
                });
                break;

            case 'partial_failure':
                if (Math.random() < 0.5) {
                    throw new Error(`[Chaos] Partial failure injected by rule: ${rule.name}`);
                }
                break;

            case 'rate_limit':
                throw Object.assign(
                    new Error(`[Chaos] Rate limit injected by rule: ${rule.name}`),
                    { statusCode: 429 }
                );

            case 'connection_reset':
                throw Object.assign(
                    new Error(`[Chaos] Connection reset injected by rule: ${rule.name}`),
                    { code: 'ECONNRESET' }
                );
        }
    }

    /**
     * Get chaos metrics.
     */
    getMetrics(): ChaosMetrics {
        return { ...this.metrics };
    }

    /**
     * Reset metrics.
     */
    resetMetrics(): void {
        this.metrics = {
            totalInvocations: 0,
            failuresInjected: 0,
            byType: {
                timeout: 0,
                error: 0,
                latency: 0,
                partial_failure: 0,
                rate_limit: 0,
                connection_reset: 0,
            },
        };
    }

    /**
     * Reset controller (for testing).
     */
    reset(): void {
        this.disable();
        this.clearRules();
        this.resetMetrics();
    }
}

// Export singleton
export const chaosController = ChaosController.getInstance();

// ============================================================================
// Chaos Decorators / Wrappers
// ============================================================================

/**
 * Wrap a function with chaos failure injection.
 */
export function withChaos<T extends (...args: unknown[]) => Promise<unknown>>(
    target: string,
    fn: T
): T {
    return (async (...args: unknown[]) => {
        await chaosController.maybeInjectFailure(target);
        return fn(...args);
    }) as T;
}

/**
 * Create a chaos-wrapped fetch function.
 */
export function chaosFetch(target: string) {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        await chaosController.maybeInjectFailure(target);
        return fetch(input, init);
    };
}

// ============================================================================
// Predefined Chaos Scenarios
// ============================================================================

export const CHAOS_SCENARIOS = {
    /**
     * Simulate LLM provider outage.
     */
    llmOutage: (): ChaosRule => ({
        name: 'llm-outage',
        target: /llm\..*/,
        failureType: 'error',
        probability: 1.0,
        config: { errorMessage: 'LLM service unavailable' },
        enabled: true,
    }),

    /**
     * Simulate high latency on database queries.
     */
    dbSlowdown: (latencyMs = 5000): ChaosRule => ({
        name: 'db-slowdown',
        target: /db\..*/,
        failureType: 'latency',
        probability: 1.0,
        config: { latencyMs },
        enabled: true,
    }),

    /**
     * Simulate intermittent Redis failures.
     */
    redisFlaky: (probability = 0.3): ChaosRule => ({
        name: 'redis-flaky',
        target: /redis\..*/,
        failureType: 'error',
        probability,
        config: { errorMessage: 'Redis connection lost' },
        enabled: true,
    }),

    /**
     * Simulate external API rate limiting.
     */
    apiRateLimit: (): ChaosRule => ({
        name: 'api-rate-limit',
        target: /api\..*/,
        failureType: 'rate_limit',
        probability: 1.0,
        enabled: true,
    }),

    /**
     * Simulate speech service degradation.
     */
    speechDegraded: (): ChaosRule => ({
        name: 'speech-degraded',
        target: /speech\..*/,
        failureType: 'partial_failure',
        probability: 0.5,
        enabled: true,
    }),
};
