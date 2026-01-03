/**
 * Feature Flag Types
 * 
 * Type definitions for the custom feature flag system.
 * 
 * @module FeatureFlagTypes
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Feature flag definition.
 */
export interface FeatureFlag {
    /** Unique key for the flag (e.g., 'new-onboarding') */
    key: string;
    /** Human-readable name */
    name: string;
    /** Description of what this flag controls */
    description?: string;
    /** Whether the flag is globally enabled */
    enabled: boolean;
    /** Rollout strategy */
    rollout: RolloutStrategy;
    /** A/B test variants (if any) */
    variants?: Variant[];
    /** User targeting rules */
    targeting?: TargetingRule[];
    /** Environments where this flag is active */
    environments?: string[];
    /** Metadata */
    createdAt: Date;
    updatedAt: Date;
    /** Who created/modified the flag */
    createdBy?: string;
}

/**
 * Rollout strategy for gradual feature rollout.
 */
export type RolloutStrategy =
    | { type: 'boolean' }
    | { type: 'percentage'; value: number }
    | { type: 'userIds'; ids: string[] }
    | { type: 'cohorts'; names: string[] }
    | { type: 'schedule'; startDate: Date; endDate?: Date };

/**
 * Variant for A/B testing.
 */
export interface Variant {
    /** Variant key (e.g., 'control', 'treatment') */
    key: string;
    /** Human-readable name */
    name: string;
    /** Weight for allocation (0-100) */
    weight: number;
    /** Optional payload data */
    payload?: Record<string, unknown>;
}

/**
 * Targeting rule for user-specific rollouts.
 */
export interface TargetingRule {
    /** Attribute to match (e.g., 'userId', 'email', 'country') */
    attribute: string;
    /** Operator for matching */
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'regex';
    /** Value(s) to match */
    value: string | string[];
}

// ============================================================================
// Evaluation Types
// ============================================================================

/**
 * Context for evaluating a feature flag.
 */
export interface EvaluationContext {
    /** User identifier (for percentage rollouts) */
    userId?: string;
    /** User email */
    email?: string;
    /** User attributes for targeting */
    attributes?: Record<string, string | number | boolean>;
    /** Current environment */
    environment?: string;
    /** Session ID (for consistent variant assignment) */
    sessionId?: string;
}

/**
 * Result of a feature flag evaluation.
 */
export interface EvaluationResult {
    /** Flag key that was evaluated */
    key: string;
    /** Whether the feature is enabled */
    enabled: boolean;
    /** Variant assigned (for A/B tests) */
    variant?: string;
    /** Variant payload (if any) */
    payload?: Record<string, unknown>;
    /** Reason for the evaluation result */
    reason: EvaluationReason;
    /** Timestamp of evaluation */
    evaluatedAt: Date;
}

/**
 * Reason for evaluation result.
 */
export type EvaluationReason =
    | 'FLAG_DISABLED'
    | 'FLAG_NOT_FOUND'
    | 'TARGETING_MATCH'
    | 'PERCENTAGE_ROLLOUT'
    | 'USER_ID_MATCH'
    | 'COHORT_MATCH'
    | 'SCHEDULE_ACTIVE'
    | 'ENVIRONMENT_MATCH'
    | 'DEFAULT';

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Stored flag format (JSON-serializable).
 */
export interface StoredFlag {
    key: string;
    name: string;
    description?: string;
    enabled: boolean;
    rollout: RolloutStrategy;
    variants?: Variant[];
    targeting?: TargetingRule[];
    environments?: string[];
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
}

/**
 * Flag update input.
 */
export interface FlagUpdate {
    name?: string;
    description?: string;
    enabled?: boolean;
    rollout?: RolloutStrategy;
    variants?: Variant[];
    targeting?: TargetingRule[];
    environments?: string[];
}

/**
 * Flag creation input.
 */
export interface FlagCreate {
    key: string;
    name: string;
    description?: string;
    enabled?: boolean;
    rollout?: RolloutStrategy;
    variants?: Variant[];
    targeting?: TargetingRule[];
    environments?: string[];
}
