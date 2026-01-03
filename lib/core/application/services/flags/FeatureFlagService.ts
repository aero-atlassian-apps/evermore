/**
 * Feature Flag Service
 * 
 * Zero-cost custom feature flag system with Redis storage.
 * Supports percentage rollouts, user targeting, A/B testing, and canary deployments.
 * 
 * @module FeatureFlagService
 */

import { logger } from '@/lib/core/application/Logger';
import { getRedisClient, getRedisManager } from '@/lib/infrastructure/adapters/cache/redis-connection';
import type {
    FeatureFlag,
    StoredFlag,
    EvaluationContext,
    EvaluationResult,
    FlagCreate,
    FlagUpdate,
    RolloutStrategy,
    TargetingRule,
    Variant,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const REDIS_PREFIX = 'ff:';
const FALLBACK_FLAGS: Map<string, FeatureFlag> = new Map();

// ============================================================================
// Feature Flag Service
// ============================================================================

export class FeatureFlagService {
    private static instance: FeatureFlagService;
    private localCache: Map<string, FeatureFlag> = new Map();
    private cacheExpiry: Map<string, number> = new Map();
    private readonly cacheTTLMs = 30_000; // 30 seconds

    private constructor() { }

    static getInstance(): FeatureFlagService {
        if (!FeatureFlagService.instance) {
            FeatureFlagService.instance = new FeatureFlagService();
        }
        return FeatureFlagService.instance;
    }

    // ========================================================================
    // Evaluation
    // ========================================================================

    /**
     * Evaluate a feature flag for the given context.
     */
    async evaluate(key: string, context: EvaluationContext = {}): Promise<EvaluationResult> {
        const flag = await this.getFlag(key);

        if (!flag) {
            return {
                key,
                enabled: false,
                reason: 'FLAG_NOT_FOUND',
                evaluatedAt: new Date(),
            };
        }

        // Check if globally disabled
        if (!flag.enabled) {
            return {
                key,
                enabled: false,
                reason: 'FLAG_DISABLED',
                evaluatedAt: new Date(),
            };
        }

        // Check environment
        if (flag.environments && flag.environments.length > 0) {
            const currentEnv = context.environment || process.env.NODE_ENV || 'development';
            if (!flag.environments.includes(currentEnv)) {
                return {
                    key,
                    enabled: false,
                    reason: 'ENVIRONMENT_MATCH',
                    evaluatedAt: new Date(),
                };
            }
        }

        // Check targeting rules
        if (flag.targeting && flag.targeting.length > 0) {
            const targetMatch = this.evaluateTargeting(flag.targeting, context);
            if (targetMatch) {
                const variant = this.assignVariant(flag, context);
                return {
                    key,
                    enabled: true,
                    variant: variant?.key,
                    payload: variant?.payload,
                    reason: 'TARGETING_MATCH',
                    evaluatedAt: new Date(),
                };
            }
        }

        // Evaluate rollout strategy
        return this.evaluateRollout(flag, context);
    }

    /**
     * Simple boolean check - is the flag enabled?
     */
    async isEnabled(key: string, context: EvaluationContext = {}): Promise<boolean> {
        const result = await this.evaluate(key, context);
        return result.enabled;
    }

    /**
     * Get variant for A/B test.
     */
    async getVariant(key: string, context: EvaluationContext = {}): Promise<string | null> {
        const result = await this.evaluate(key, context);
        return result.variant || null;
    }

    // ========================================================================
    // Rollout Evaluation
    // ========================================================================

    private evaluateRollout(flag: FeatureFlag, context: EvaluationContext): EvaluationResult {
        const rollout = flag.rollout;
        const variant = this.assignVariant(flag, context);

        switch (rollout.type) {
            case 'boolean':
                return {
                    key: flag.key,
                    enabled: true,
                    variant: variant?.key,
                    payload: variant?.payload,
                    reason: 'DEFAULT',
                    evaluatedAt: new Date(),
                };

            case 'percentage': {
                const hash = this.hashUserId(context.userId || context.sessionId || 'anonymous', flag.key);
                const enabled = hash < rollout.value;
                return {
                    key: flag.key,
                    enabled,
                    variant: enabled ? variant?.key : undefined,
                    payload: enabled ? variant?.payload : undefined,
                    reason: 'PERCENTAGE_ROLLOUT',
                    evaluatedAt: new Date(),
                };
            }

            case 'userIds': {
                const enabled = context.userId ? rollout.ids.includes(context.userId) : false;
                return {
                    key: flag.key,
                    enabled,
                    variant: enabled ? variant?.key : undefined,
                    payload: enabled ? variant?.payload : undefined,
                    reason: 'USER_ID_MATCH',
                    evaluatedAt: new Date(),
                };
            }

            case 'cohorts': {
                const userCohort = context.attributes?.cohort as string;
                const enabled = userCohort ? rollout.names.includes(userCohort) : false;
                return {
                    key: flag.key,
                    enabled,
                    variant: enabled ? variant?.key : undefined,
                    payload: enabled ? variant?.payload : undefined,
                    reason: 'COHORT_MATCH',
                    evaluatedAt: new Date(),
                };
            }

            case 'schedule': {
                const now = new Date();
                const started = now >= rollout.startDate;
                const notEnded = !rollout.endDate || now <= rollout.endDate;
                const enabled = started && notEnded;
                return {
                    key: flag.key,
                    enabled,
                    variant: enabled ? variant?.key : undefined,
                    payload: enabled ? variant?.payload : undefined,
                    reason: 'SCHEDULE_ACTIVE',
                    evaluatedAt: new Date(),
                };
            }

            default:
                return {
                    key: flag.key,
                    enabled: true,
                    variant: variant?.key,
                    payload: variant?.payload,
                    reason: 'DEFAULT',
                    evaluatedAt: new Date(),
                };
        }
    }

    // ========================================================================
    // Targeting Evaluation
    // ========================================================================

    private evaluateTargeting(rules: TargetingRule[], context: EvaluationContext): boolean {
        for (const rule of rules) {
            let value: string | undefined;

            // Get attribute value
            if (rule.attribute === 'userId') {
                value = context.userId;
            } else if (rule.attribute === 'email') {
                value = context.email;
            } else {
                value = context.attributes?.[rule.attribute] as string | undefined;
            }

            if (!value) continue;

            const ruleValue = Array.isArray(rule.value) ? rule.value : [rule.value];

            switch (rule.operator) {
                case 'equals':
                    if (ruleValue.includes(value)) return true;
                    break;
                case 'contains':
                    if (ruleValue.some(v => value!.includes(v))) return true;
                    break;
                case 'startsWith':
                    if (ruleValue.some(v => value!.startsWith(v))) return true;
                    break;
                case 'endsWith':
                    if (ruleValue.some(v => value!.endsWith(v))) return true;
                    break;
                case 'in':
                    if (ruleValue.includes(value)) return true;
                    break;
                case 'regex':
                    if (ruleValue.some(v => new RegExp(v).test(value!))) return true;
                    break;
            }
        }
        return false;
    }

    // ========================================================================
    // Variant Assignment
    // ========================================================================

    private assignVariant(flag: FeatureFlag, context: EvaluationContext): Variant | undefined {
        if (!flag.variants || flag.variants.length === 0) {
            return undefined;
        }

        // Use consistent hashing for sticky variant assignment
        const hash = this.hashUserId(
            context.userId || context.sessionId || 'anonymous',
            `${flag.key}:variant`
        );

        // Normalize weights
        const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0);
        let cumulative = 0;

        for (const variant of flag.variants) {
            cumulative += (variant.weight / totalWeight) * 100;
            if (hash < cumulative) {
                return variant;
            }
        }

        return flag.variants[0];
    }

    // ========================================================================
    // Hash Function (for consistent rollouts)
    // ========================================================================

    private hashUserId(userId: string, salt: string): number {
        // Simple but effective hash for percentage calculation (0-100)
        const str = `${userId}:${salt}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash) % 100;
    }

    // ========================================================================
    // CRUD Operations
    // ========================================================================

    /**
     * Get a flag by key.
     */
    async getFlag(key: string): Promise<FeatureFlag | null> {
        // Check local cache first
        const cached = this.localCache.get(key);
        const expiry = this.cacheExpiry.get(key);
        if (cached && expiry && Date.now() < expiry) {
            return cached;
        }

        // Try Redis
        if (getRedisManager().isConnected()) {
            try {
                const redis = await getRedisClient();
                if (redis) {
                    const data = await redis.get(`${REDIS_PREFIX}${key}`);
                    if (data) {
                        const stored: StoredFlag = JSON.parse(data);
                        const flag = this.deserializeFlag(stored);
                        this.cacheFlag(flag);
                        return flag;
                    }
                }
            } catch (error) {
                logger.warn('[FeatureFlags] Redis error, using fallback', { error });
            }
        }

        // Check fallback
        return FALLBACK_FLAGS.get(key) || null;
    }

    /**
     * Get all flags.
     */
    async getAllFlags(): Promise<FeatureFlag[]> {
        if (getRedisManager().isConnected()) {
            try {
                const redis = await getRedisClient();
                if (redis) {
                    const keys = await redis.keys(`${REDIS_PREFIX}*`);
                    if (keys.length === 0) return [];

                    const data = await redis.mget(keys);
                    return data
                        .filter((d): d is string => d !== null)
                        .map(d => this.deserializeFlag(JSON.parse(d)));
                }
            } catch (error) {
                logger.warn('[FeatureFlags] Redis error getting all flags', { error });
            }
        }
        return Array.from(FALLBACK_FLAGS.values());
    }

    /**
     * Create a new flag.
     */
    async createFlag(input: FlagCreate): Promise<FeatureFlag> {
        const now = new Date();
        const flag: FeatureFlag = {
            key: input.key,
            name: input.name,
            description: input.description,
            enabled: input.enabled ?? false,
            rollout: input.rollout ?? { type: 'boolean' },
            variants: input.variants,
            targeting: input.targeting,
            environments: input.environments,
            createdAt: now,
            updatedAt: now,
        };

        await this.saveFlag(flag);
        return flag;
    }

    /**
     * Update an existing flag.
     */
    async updateFlag(key: string, updates: FlagUpdate): Promise<FeatureFlag | null> {
        const existing = await this.getFlag(key);
        if (!existing) return null;

        const updated: FeatureFlag = {
            ...existing,
            ...updates,
            updatedAt: new Date(),
        };

        await this.saveFlag(updated);
        return updated;
    }

    /**
     * Delete a flag.
     */
    async deleteFlag(key: string): Promise<boolean> {
        this.localCache.delete(key);
        this.cacheExpiry.delete(key);
        FALLBACK_FLAGS.delete(key);

        if (getRedisManager().isConnected()) {
            try {
                const redis = await getRedisClient();
                if (redis) {
                    await redis.del(`${REDIS_PREFIX}${key}`);
                    return true;
                }
            } catch (error) {
                logger.warn('[FeatureFlags] Redis error deleting flag', { error });
            }
        }
        return true;
    }

    // ========================================================================
    // Storage Helpers
    // ========================================================================

    private async saveFlag(flag: FeatureFlag): Promise<void> {
        this.cacheFlag(flag);
        FALLBACK_FLAGS.set(flag.key, flag);

        if (getRedisManager().isConnected()) {
            try {
                const redis = await getRedisClient();
                if (redis) {
                    const stored = this.serializeFlag(flag);
                    await redis.set(`${REDIS_PREFIX}${flag.key}`, JSON.stringify(stored));
                }
            } catch (error) {
                logger.warn('[FeatureFlags] Redis error saving flag', { error });
            }
        }
    }

    private cacheFlag(flag: FeatureFlag): void {
        this.localCache.set(flag.key, flag);
        this.cacheExpiry.set(flag.key, Date.now() + this.cacheTTLMs);
    }

    private serializeFlag(flag: FeatureFlag): StoredFlag {
        return {
            ...flag,
            createdAt: flag.createdAt.toISOString(),
            updatedAt: flag.updatedAt.toISOString(),
        };
    }

    private deserializeFlag(stored: StoredFlag): FeatureFlag {
        return {
            ...stored,
            createdAt: new Date(stored.createdAt),
            updatedAt: new Date(stored.updatedAt),
            rollout: this.deserializeRollout(stored.rollout),
        };
    }

    private deserializeRollout(rollout: RolloutStrategy): RolloutStrategy {
        if (rollout.type === 'schedule') {
            return {
                ...rollout,
                startDate: new Date(rollout.startDate as unknown as string),
                endDate: rollout.endDate ? new Date(rollout.endDate as unknown as string) : undefined,
            };
        }
        return rollout;
    }

    // ========================================================================
    // Initialization Helpers
    // ========================================================================

    /**
     * Register default flags (for local development or fallback).
     */
    registerDefaultFlags(flags: FlagCreate[]): void {
        for (const input of flags) {
            const now = new Date();
            const flag: FeatureFlag = {
                key: input.key,
                name: input.name,
                description: input.description,
                enabled: input.enabled ?? false,
                rollout: input.rollout ?? { type: 'boolean' },
                variants: input.variants,
                targeting: input.targeting,
                environments: input.environments,
                createdAt: now,
                updatedAt: now,
            };
            FALLBACK_FLAGS.set(flag.key, flag);
        }
    }

    /**
     * Clear local cache.
     */
    clearCache(): void {
        this.localCache.clear();
        this.cacheExpiry.clear();
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const featureFlagService = FeatureFlagService.getInstance();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick check if a feature is enabled.
 */
export async function isFeatureEnabled(
    key: string,
    context: EvaluationContext = {}
): Promise<boolean> {
    return featureFlagService.isEnabled(key, context);
}

/**
 * Get variant for A/B test.
 */
export async function getFeatureVariant(
    key: string,
    context: EvaluationContext = {}
): Promise<string | null> {
    return featureFlagService.getVariant(key, context);
}

/**
 * Evaluate a feature flag.
 */
export async function evaluateFlag(
    key: string,
    context: EvaluationContext = {}
): Promise<EvaluationResult> {
    return featureFlagService.evaluate(key, context);
}
