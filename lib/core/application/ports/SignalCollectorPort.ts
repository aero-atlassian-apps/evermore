/**
 * Signal Collector Port - Interface for interaction signal collection.
 * 
 * Domain-side interface for the data flywheel.
 * Implementation lives in infrastructure layer.
 * 
 * @module SignalCollectorPort
 * @boundedContext InteractionSignals
 */

import { InteractionSignal } from '../../domain/InteractionSignal';

// ============================================================================
// Port Interface
// ============================================================================

/**
 * Port for collecting and querying interaction signals.
 * Follows Interface Segregation Principle - minimal focused interface.
 */
export interface SignalCollectorPort {
    /**
     * Record a new interaction signal.
     * This is the primary collection method for the data flywheel.
     */
    recordSignal(signal: InteractionSignal): Promise<void>;

    /**
     * Get recent signals for a user.
     * Used for preference pair generation.
     */
    getRecentSignals(userId: string, limit: number): Promise<InteractionSignal[]>;

    /**
     * Get signals by session.
     * Used for session-level analysis.
     */
    getSessionSignals(sessionId: string): Promise<InteractionSignal[]>;

    /**
     * Get high-satisfaction signals for preference pairing.
     * Returns signals with satisfactionScore > threshold.
     */
    getHighSatisfactionSignals(
        minScore: number,
        limit: number,
        olderThanDays?: number
    ): Promise<InteractionSignal[]>;

    /**
     * Get low-satisfaction signals for preference pairing.
     * Returns signals with satisfactionScore < threshold.
     */
    getLowSatisfactionSignals(
        maxScore: number,
        limit: number,
        olderThanDays?: number
    ): Promise<InteractionSignal[]>;

    /**
     * Get signal count statistics.
     * Used for dashboard and investor visibility.
     */
    getStats(): Promise<SignalStats>;

    /**
     * Update implicit feedback for a signal.
     * Called when we learn more about the interaction outcome.
     */
    updateImplicitFeedback(
        signalId: string,
        feedback: Partial<InteractionSignal['implicitFeedback']>
    ): Promise<void>;

    /**
     * Update explicit feedback for a signal.
     * Called when user provides a rating.
     */
    updateExplicitFeedback(signalId: string, rating: number): Promise<void>;
}

/**
 * Signal collection statistics.
 */
export interface SignalStats {
    /** Total signals collected */
    totalCount: number;
    /** Signals in last 24 hours */
    last24Hours: number;
    /** Signals in last 7 days */
    last7Days: number;
    /** Signals with explicit feedback */
    withExplicitFeedback: number;
    /** Average satisfaction score */
    averageSatisfaction: number;
    /** Count by emotion category */
    byEmotion: Record<string, number>;
    /** Unique users */
    uniqueUsers: number;
}

// ============================================================================
// Preference Pair Port (for learning pipeline integration)
// ============================================================================

/**
 * Port for generating preference pairs from signals.
 * Bridges InteractionSignals context with Learning context.
 */
export interface SignalToPreferencePort {
    /**
     * Generate preference pairs from collected signals.
     * Returns pairs suitable for DPO training.
     */
    generatePreferencePairs(
        minPairs: number,
        minSatisfactionDelta: number
    ): Promise<PreferencePairCandidate[]>;

    /**
     * Mark signals as used in training.
     * Prevents duplicate training on same data.
     */
    markSignalsAsUsed(signalIds: string[]): Promise<void>;
}

/**
 * Candidate preference pair from signals.
 */
export interface PreferencePairCandidate {
    /** High satisfaction signal */
    chosenSignal: InteractionSignal;
    /** Low satisfaction signal */
    rejectedSignal: InteractionSignal;
    /** Satisfaction delta */
    delta: number;
    /** Confidence in this pairing */
    confidence: number;
}
