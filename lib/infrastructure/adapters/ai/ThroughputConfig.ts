/**
 * ThroughputConfig - Centralized configuration for LLM rate limiting and throughput control.
 * 
 * This module defines:
 * - Provider rate limits (RPM/TPM)
 * - Request priority tiers
 * - Per-tier execution policies
 * - Circuit breaker thresholds
 * 
 * @module ThroughputConfig
 */

// ============================================================================
// Request Priority Tiers
// ============================================================================

/**
 * Priority tiers for LLM requests.
 * Higher priority = processed first, lower priority = can be delayed/shed.
 */
export enum RequestTier {
    /** Critical user-facing: safety checks, blocking UX. Never queue. */
    CRITICAL = 0,
    /** Important interactive: agent reasoning, user responses. Fair queue. */
    INTERACTIVE = 1,
    /** Background/analytical: storybooks, chapters. Aggressive queuing. */
    BACKGROUND = 2,
}

// ============================================================================
// Provider Rate Limits
// ============================================================================

/**
 * Rate limit configuration for LLM providers.
 */
export interface ProviderLimits {
    /** Requests per minute */
    rpmLimit: number;
    /** Tokens per minute */
    tpmLimit: number;
    /** Extra requests allowed in burst */
    burstAllowance: number;
    /** Token bucket refill rate (tokens per ms) */
    refillRatePerMs: number;
}

/**
 * Gemini API limits (free tier / AI Studio).
 * Adjust based on your quota.
 */
export const GEMINI_LIMITS: ProviderLimits = {
    rpmLimit: 15,
    tpmLimit: 1_000_000,
    burstAllowance: 5,
    refillRatePerMs: 0.25, // ~15 RPM = 0.25 per second
};

/**
 * Gemini API limits (paid tier / higher quota).
 */
export const GEMINI_LIMITS_PAID: ProviderLimits = {
    rpmLimit: 60,
    tpmLimit: 4_000_000,
    burstAllowance: 10,
    refillRatePerMs: 1.0,
};

// ============================================================================
// Tier Execution Policies
// ============================================================================

/**
 * Execution policy for a request tier.
 */
export interface TierPolicy {
    /** Maximum concurrent requests for this tier */
    maxConcurrency: number;
    /** Request timeout in ms */
    timeoutMs: number;
    /** Maximum retry attempts */
    maxRetries: number;
    /** Base delay for exponential backoff (ms) */
    retryBaseDelayMs: number;
    /** How long to wait in queue before rejecting (ms) */
    queueTimeoutMs: number;
    /** What to do when queue is full */
    onQueueFull: 'REJECT' | 'DELAY' | 'STREAM_PARTIAL';
    /** Fallback behavior when circuit is open */
    fallbackBehavior: 'THROW' | 'RETURN_CACHED' | 'RETURN_DEFAULT' | 'DEGRADE';
}

/**
 * Per-tier execution policies.
 */
export const TIER_POLICIES: Record<RequestTier, TierPolicy> = {
    [RequestTier.CRITICAL]: {
        maxConcurrency: Infinity,  // Never block safety checks
        timeoutMs: 1000,           // Fail fast
        maxRetries: 1,             // Quick retry, then fail-safe
        retryBaseDelayMs: 100,
        queueTimeoutMs: 0,         // No queuing
        onQueueFull: 'REJECT',
        fallbackBehavior: 'DEGRADE', // Degrade to regex-only
    },
    [RequestTier.INTERACTIVE]: {
        maxConcurrency: 3,         // Limit parallel agent steps
        timeoutMs: 15000,          // Reasonable wait
        maxRetries: 3,             // Full retry with backoff
        retryBaseDelayMs: 1000,
        queueTimeoutMs: 20000,     // How long to wait in queue
        onQueueFull: 'STREAM_PARTIAL', // Show thinking indicator
        fallbackBehavior: 'THROW',
    },
    [RequestTier.BACKGROUND]: {
        maxConcurrency: 1,         // One at a time to preserve budget
        timeoutMs: 60000,          // Patient
        maxRetries: 5,             // Keep trying
        retryBaseDelayMs: 2000,
        queueTimeoutMs: 120000,    // Very patient
        onQueueFull: 'DELAY',      // Just wait
        fallbackBehavior: 'RETURN_CACHED',
    },
};

// ============================================================================
// Circuit Breaker Configuration
// ============================================================================

/**
 * Circuit breaker states.
 */
export enum CircuitState {
    /** Normal operation, requests flow through */
    CLOSED = 'CLOSED',
    /** Failures exceeded threshold, requests blocked */
    OPEN = 'OPEN',
    /** Testing if service recovered */
    HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
    /** Number of failures to open circuit */
    failureThreshold: number;
    /** Time window for failure counting (ms) */
    failureWindowMs: number;
    /** How long to stay open before testing (ms) */
    openDurationMs: number;
    /** Number of successes in half-open to close */
    successThreshold: number;
}

export const CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    failureWindowMs: 60000,      // 1 minute
    openDurationMs: 30000,       // 30 seconds
    successThreshold: 1,
};

// ============================================================================
// Queue Configuration
// ============================================================================

/**
 * Queue configuration.
 */
export interface QueueConfig {
    /** Maximum queue depth before shedding */
    maxDepth: number;
    /** Depth at which to warn */
    warnDepth: number;
    /** Depth at which to start shedding Tier 2 */
    shedTier2Depth: number;
    /** Depth at which to start shedding Tier 1 */
    shedTier1Depth: number;
}

export const QUEUE_CONFIG: QueueConfig = {
    maxDepth: 100,
    warnDepth: 10,
    shedTier2Depth: 25,
    shedTier1Depth: 50,
};

// ============================================================================
// Budget Configuration
// ============================================================================

/**
 * Token budget limits per tier (daily).
 */
export const TIER_BUDGETS: Record<RequestTier, number> = {
    [RequestTier.CRITICAL]: Infinity,   // Never limit safety
    [RequestTier.INTERACTIVE]: 100000,  // 100K tokens/day
    [RequestTier.BACKGROUND]: 500000,   // 500K tokens/day
};

// ============================================================================
// Environment-based Configuration
// ============================================================================

/**
 * Get provider limits based on environment.
 */
export function getProviderLimits(): ProviderLimits {
    const tier = process.env.GEMINI_TIER || 'free';
    return tier === 'paid' ? GEMINI_LIMITS_PAID : GEMINI_LIMITS;
}

/**
 * Check if throughput controls should be enabled.
 */
export function isThroughputEnabled(): boolean {
    // Always enabled - this is production infrastructure, not a dev toggle
    return true;
}
