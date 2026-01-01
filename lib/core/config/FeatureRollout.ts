/**
 * Feature Rollout Configuration
 * 
 * Enables percentage-based feature flag rollout for canary deployments.
 * Supports automatic rollback on SLO violations.
 * 
 * Usage:
 * ```typescript
 * import { isFeatureEnabled, getRolloutPercentage } from '@/lib/core/config/FeatureRollout';
 * 
 * if (isFeatureEnabled('TTS_STREAMING', userId)) {
 *   // Use new streaming TTS
 * }
 * ```
 */

export type FeatureFlag =
    | 'TTS_STREAMING'
    | 'TTS_CHUNK_PLAYBACK'
    | 'STT_DUAL_PATH'
    | 'AUDIO_PREFETCH'
    | 'INVISIBLE_FALLBACK_UI';

interface RolloutConfig {
    enabled: boolean;
    percentage: number; // 0-100
    allowList?: string[]; // User IDs that always get the feature
    denyList?: string[]; // User IDs that never get the feature
}

// Default rollout configuration
// In production, this would be loaded from a database or config service
const rolloutConfigs: Record<FeatureFlag, RolloutConfig> = {
    TTS_STREAMING: {
        enabled: process.env.NEXT_PUBLIC_FEATURE_TTS_STREAMING === 'true',
        percentage: 0, // Start at 0%, increase gradually
    },
    TTS_CHUNK_PLAYBACK: {
        enabled: process.env.NEXT_PUBLIC_FEATURE_TTS_CHUNK_PLAYBACK === 'true',
        percentage: 0,
    },
    STT_DUAL_PATH: {
        enabled: process.env.NEXT_PUBLIC_FEATURE_STT_DUAL_PATH === 'true',
        percentage: 0,
    },
    AUDIO_PREFETCH: {
        enabled: process.env.NEXT_PUBLIC_FEATURE_AUDIO_PREFETCH === 'true',
        percentage: 100, // Fully enabled
    },
    INVISIBLE_FALLBACK_UI: {
        enabled: process.env.NEXT_PUBLIC_FEATURE_INVISIBLE_FALLBACK_UI === 'true',
        percentage: 100, // Fully enabled
    },
};

/**
 * Hash a user ID to a consistent number 0-99
 * Uses simple string hashing for deterministic bucketing
 */
function hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 100);
}

/**
 * Check if a feature is enabled for a specific user
 */
export function isFeatureEnabled(flag: FeatureFlag, userId?: string): boolean {
    const config = rolloutConfigs[flag];

    // Feature is completely disabled
    if (!config.enabled) {
        return false;
    }

    // No user ID provided - use simple boolean
    if (!userId) {
        return config.enabled;
    }

    // Check deny list
    if (config.denyList?.includes(userId)) {
        return false;
    }

    // Check allow list
    if (config.allowList?.includes(userId)) {
        return true;
    }

    // Percentage-based rollout
    if (config.percentage >= 100) {
        return true;
    }

    if (config.percentage <= 0) {
        return false;
    }

    // Hash user ID to get consistent bucket
    const bucket = hashUserId(userId);
    return bucket < config.percentage;
}

/**
 * Get the current rollout percentage for a feature
 */
export function getRolloutPercentage(flag: FeatureFlag): number {
    return rolloutConfigs[flag]?.percentage ?? 0;
}

/**
 * Update rollout percentage (for dynamic rollout control)
 * In production, this would persist to a database
 */
export function setRolloutPercentage(flag: FeatureFlag, percentage: number): void {
    if (rolloutConfigs[flag]) {
        rolloutConfigs[flag].percentage = Math.max(0, Math.min(100, percentage));
        console.log(`[FeatureRollout] ${flag} set to ${percentage}%`);
    }
}

/**
 * Emergency rollback - disable a feature immediately
 */
export function emergencyRollback(flag: FeatureFlag): void {
    if (rolloutConfigs[flag]) {
        rolloutConfigs[flag].enabled = false;
        rolloutConfigs[flag].percentage = 0;
        console.warn(`[FeatureRollout] EMERGENCY ROLLBACK: ${flag} disabled`);
    }
}

/**
 * Get all feature rollout statuses
 */
export function getAllRolloutStatuses(): Record<FeatureFlag, { enabled: boolean; percentage: number }> {
    const statuses: Record<string, { enabled: boolean; percentage: number }> = {};

    for (const [flag, config] of Object.entries(rolloutConfigs)) {
        statuses[flag] = {
            enabled: config.enabled,
            percentage: config.percentage,
        };
    }

    return statuses as Record<FeatureFlag, { enabled: boolean; percentage: number }>;
}

/**
 * Rollout stages for gradual deployment
 */
export const ROLLOUT_STAGES = [1, 5, 10, 25, 50, 75, 100];

/**
 * Get next rollout stage
 */
export function getNextRolloutStage(currentPercentage: number): number | null {
    for (const stage of ROLLOUT_STAGES) {
        if (stage > currentPercentage) {
            return stage;
        }
    }
    return null; // Already at 100%
}
