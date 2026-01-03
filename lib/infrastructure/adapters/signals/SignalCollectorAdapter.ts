/**
 * Signal Collector Adapter - In-memory implementation for data flywheel.
 * 
 * Production-ready adapter with persistence hooks.
 * Starts with in-memory for fast iteration, easily swappable to Postgres.
 * 
 * @module SignalCollectorAdapter
 * @boundedContext InteractionSignals (Infrastructure)
 */

import {
    InteractionSignal,
    validateInteractionSignal,
} from '../../../core/domain/InteractionSignal';
import {
    SignalCollectorPort,
    SignalStats,
    SignalToPreferencePort,
    PreferencePairCandidate,
} from '../../../core/application/ports/SignalCollectorPort';

// ============================================================================
// Configuration
// ============================================================================

interface SignalCollectorConfig {
    /** Maximum signals to keep in memory */
    maxSignals: number;
    /** Auto-persist interval (ms), 0 = disabled */
    persistIntervalMs: number;
    /** Enable console logging */
    debug: boolean;
}

const DEFAULT_CONFIG: SignalCollectorConfig = {
    maxSignals: 100000,
    persistIntervalMs: 0,
    debug: false,
};

// ============================================================================
// Signal Collector Adapter
// ============================================================================

/**
 * In-memory signal collector with optional persistence.
 * 
 * Usage:
 * ```typescript
 * const collector = new SignalCollectorAdapter();
 * 
 * // Record signal
 * await collector.recordSignal(signal);
 * 
 * // Get stats for dashboard
 * const stats = await collector.getStats();
 * console.log(`Collected ${stats.totalCount} signals`);
 * ```
 */
export class SignalCollectorAdapter implements SignalCollectorPort, SignalToPreferencePort {
    private signals: Map<string, InteractionSignal> = new Map();
    private usedSignals: Set<string> = new Set();
    private config: SignalCollectorConfig;

    constructor(config?: Partial<SignalCollectorConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // SignalCollectorPort Implementation
    // =========================================================================

    async recordSignal(signal: InteractionSignal): Promise<void> {
        // Validate before storing
        const validation = validateInteractionSignal(signal);
        if (!validation.valid) {
            console.warn('[SignalCollector] Invalid signal:', validation.errors);
            return;
        }

        // Enforce max signals (LRU eviction)
        if (this.signals.size >= this.config.maxSignals) {
            const oldest = this.findOldestSignal();
            if (oldest) {
                this.signals.delete(oldest);
            }
        }

        this.signals.set(signal.id, signal);

        if (this.config.debug) {
            console.log(`[SignalCollector] Recorded signal ${signal.id} (satisfaction: ${signal.satisfactionScore.toFixed(2)})`);
        }
    }

    async getRecentSignals(userId: string, limit: number): Promise<InteractionSignal[]> {
        const userSignals = Array.from(this.signals.values())
            .filter(s => s.userId === userId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);

        return userSignals;
    }

    async getSessionSignals(sessionId: string): Promise<InteractionSignal[]> {
        return Array.from(this.signals.values())
            .filter(s => s.sessionId === sessionId)
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async getHighSatisfactionSignals(
        minScore: number,
        limit: number,
        olderThanDays?: number
    ): Promise<InteractionSignal[]> {
        const cutoff = olderThanDays
            ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000
            : 0;

        return Array.from(this.signals.values())
            .filter(s => s.satisfactionScore >= minScore)
            .filter(s => s.timestamp >= cutoff)
            .filter(s => !this.usedSignals.has(s.id))
            .sort((a, b) => b.satisfactionScore - a.satisfactionScore)
            .slice(0, limit);
    }

    async getLowSatisfactionSignals(
        maxScore: number,
        limit: number,
        olderThanDays?: number
    ): Promise<InteractionSignal[]> {
        const cutoff = olderThanDays
            ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000
            : 0;

        return Array.from(this.signals.values())
            .filter(s => s.satisfactionScore <= maxScore)
            .filter(s => s.timestamp >= cutoff)
            .filter(s => !this.usedSignals.has(s.id))
            .sort((a, b) => a.satisfactionScore - b.satisfactionScore)
            .slice(0, limit);
    }

    async getStats(): Promise<SignalStats> {
        const signals = Array.from(this.signals.values());
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        const byEmotion: Record<string, number> = {};
        const uniqueUsers = new Set<string>();
        let withExplicit = 0;
        let totalSatisfaction = 0;

        for (const signal of signals) {
            uniqueUsers.add(signal.userId);
            byEmotion[signal.detectedEmotion] = (byEmotion[signal.detectedEmotion] || 0) + 1;
            if (signal.explicitFeedback !== undefined) withExplicit++;
            totalSatisfaction += signal.satisfactionScore;
        }

        return {
            totalCount: signals.length,
            last24Hours: signals.filter(s => s.timestamp >= oneDayAgo).length,
            last7Days: signals.filter(s => s.timestamp >= oneWeekAgo).length,
            withExplicitFeedback: withExplicit,
            averageSatisfaction: signals.length > 0 ? totalSatisfaction / signals.length : 0,
            byEmotion,
            uniqueUsers: uniqueUsers.size,
        };
    }

    async updateImplicitFeedback(
        signalId: string,
        feedback: Partial<InteractionSignal['implicitFeedback']>
    ): Promise<void> {
        const signal = this.signals.get(signalId);
        if (!signal) return;

        // Create updated signal (immutable pattern)
        const updated: InteractionSignal = {
            ...signal,
            implicitFeedback: {
                ...signal.implicitFeedback,
                ...feedback,
            },
        };

        // Recompute satisfaction
        const satisfactionScore = this.recomputeSatisfaction(updated);

        this.signals.set(signalId, {
            ...updated,
            satisfactionScore,
        } as InteractionSignal);
    }

    async updateExplicitFeedback(signalId: string, rating: number): Promise<void> {
        const signal = this.signals.get(signalId);
        if (!signal) return;

        // Clamp rating to valid range
        const clampedRating = Math.max(1, Math.min(5, rating));

        const updated: InteractionSignal = {
            ...signal,
            explicitFeedback: clampedRating,
        };

        const satisfactionScore = this.recomputeSatisfaction(updated);

        this.signals.set(signalId, {
            ...updated,
            satisfactionScore,
        } as InteractionSignal);
    }

    // =========================================================================
    // SignalToPreferencePort Implementation
    // =========================================================================

    async generatePreferencePairs(
        minPairs: number,
        minSatisfactionDelta: number
    ): Promise<PreferencePairCandidate[]> {
        const pairs: PreferencePairCandidate[] = [];

        // Get high and low satisfaction pools
        const highPool = await this.getHighSatisfactionSignals(0.7, minPairs * 2);
        const lowPool = await this.getLowSatisfactionSignals(0.3, minPairs * 2);

        // Generate pairs with sufficient delta
        for (const high of highPool) {
            for (const low of lowPool) {
                // Skip if already have enough pairs
                if (pairs.length >= minPairs) break;

                // Skip if different intents (comparing apples to apples)
                if (high.intentCategory !== low.intentCategory) continue;

                const delta = high.satisfactionScore - low.satisfactionScore;
                if (delta < minSatisfactionDelta) continue;

                pairs.push({
                    chosenSignal: high,
                    rejectedSignal: low,
                    delta,
                    confidence: Math.min(1, delta / 0.5), // Normalize confidence
                });
            }

            if (pairs.length >= minPairs) break;
        }

        return pairs;
    }

    async markSignalsAsUsed(signalIds: string[]): Promise<void> {
        for (const id of signalIds) {
            this.usedSignals.add(id);
        }
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    private findOldestSignal(): string | undefined {
        let oldest: string | undefined;
        let oldestTime = Infinity;

        for (const [id, signal] of this.signals) {
            if (signal.timestamp < oldestTime) {
                oldestTime = signal.timestamp;
                oldest = id;
            }
        }

        return oldest;
    }

    private recomputeSatisfaction(signal: InteractionSignal): number {
        if (signal.explicitFeedback !== undefined) {
            const explicit = (signal.explicitFeedback - 1) / 4;
            const implicit = this.computeImplicitScore(signal.implicitFeedback);
            return explicit * 0.7 + implicit * 0.3;
        }
        return this.computeImplicitScore(signal.implicitFeedback);
    }

    private computeImplicitScore(feedback: InteractionSignal['implicitFeedback']): number {
        let score = 0.5;

        if (feedback.sessionContinued) score += 0.15;
        if (feedback.followUpQuestions > 0) score += Math.min(0.15, feedback.followUpQuestions * 0.05);
        if (feedback.nextMessageLength > 20) score += 0.1;
        if (feedback.topicChange) score -= 0.1;
        if (feedback.conversationEndedBy === 'user') score -= 0.05;
        if (feedback.conversationEndedBy === 'timeout') score -= 0.15;
        if (feedback.responseDelayMs > 30000) score -= 0.1;

        return Math.max(0, Math.min(1, score));
    }

    // =========================================================================
    // Export/Import for Persistence
    // =========================================================================

    /**
     * Export all signals for persistence.
     */
    exportSignals(): InteractionSignal[] {
        return Array.from(this.signals.values());
    }

    /**
     * Import signals from storage.
     */
    importSignals(signals: InteractionSignal[]): void {
        for (const signal of signals) {
            this.signals.set(signal.id, signal);
        }
    }

    /**
     * Get count for quick checks.
     */
    getCount(): number {
        return this.signals.size;
    }

    /**
     * Clear all signals.
     */
    clear(): void {
        this.signals.clear();
        this.usedSignals.clear();
    }
}
