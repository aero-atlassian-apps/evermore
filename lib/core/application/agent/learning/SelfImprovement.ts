/**
 * Agent Self-Improvement System - Learning from execution for continuous improvement.
 * 
 * Implements agent self-improvement capabilities:
 * - Execution outcome tracking
 * - Pattern recognition in failures/successes
 * - Prompt refinement suggestions
 * - Strategy adaptation
 * - Performance baseline tracking
 * 
 * @module SelfImprovement
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Outcome of an agent execution.
 */
export enum ExecutionOutcome {
    SUCCESS = 'SUCCESS',
    PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
    FAILURE = 'FAILURE',
    TIMEOUT = 'TIMEOUT',
    ERROR = 'ERROR',
    USER_CANCELLED = 'USER_CANCELLED',
}

/**
 * Recorded execution for learning.
 */
export interface ExecutionRecord {
    /** Unique ID */
    id: string;
    /** Agent ID */
    agentId: string;
    /** Goal */
    goal: string;
    /** Outcome */
    outcome: ExecutionOutcome;
    /** User satisfaction (if provided) */
    userSatisfaction?: number; // 1-5
    /** Steps taken */
    stepCount: number;
    /** Tokens used */
    tokenUsage: number;
    /** Cost in cents */
    costCents: number;
    /** Duration in ms */
    durationMs: number;
    /** Tools used */
    toolsUsed: string[];
    /** Error patterns (if any) */
    errorPatterns: string[];
    /** Successful patterns */
    successPatterns: string[];
    /** Timestamp */
    timestamp: number;
    /** Strategy used */
    strategy?: string;
    /** Context features */
    contextFeatures: Record<string, unknown>;
}

/**
 * Learned pattern from executions.
 */
export interface LearnedPattern {
    /** Pattern ID */
    id: string;
    /** Pattern type */
    type: 'success' | 'failure' | 'optimization';
    /** Pattern description */
    description: string;
    /** Confidence (0-1) */
    confidence: number;
    /** Number of observations */
    observationCount: number;
    /** Conditions when pattern applies */
    conditions: PatternCondition[];
    /** Recommended action */
    recommendation: string;
    /** Impact score (how much did following this pattern help) */
    impactScore: number;
    /** Created at */
    createdAt: number;
    /** Last updated */
    updatedAt: number;
}

/**
 * Condition for pattern matching.
 */
export interface PatternCondition {
    /** Feature name */
    feature: string;
    /** Operator */
    operator: 'equals' | 'contains' | 'gt' | 'lt' | 'exists';
    /** Value to compare */
    value: unknown;
}

/**
 * Improvement suggestion.
 */
export interface ImprovementSuggestion {
    /** Suggestion ID */
    id: string;
    /** Category */
    category: 'prompt' | 'strategy' | 'tool' | 'timeout' | 'cost' | 'general';
    /** Priority (1-5) */
    priority: number;
    /** Description */
    description: string;
    /** Expected impact */
    expectedImpact: string;
    /** Confidence in suggestion */
    confidence: number;
    /** Supporting evidence (execution IDs) */
    evidence: string[];
    /** Created at */
    createdAt: number;
    /** Status */
    status: 'pending' | 'applied' | 'rejected' | 'testing';
}

/**
 * Performance baseline.
 */
export interface PerformanceBaseline {
    /** Agent ID */
    agentId: string;
    /** Time window (e.g., 'daily', 'weekly') */
    window: string;
    /** Success rate */
    successRate: number;
    /** Average duration */
    avgDurationMs: number;
    /** Average tokens */
    avgTokens: number;
    /** Average cost */
    avgCostCents: number;
    /** Average user satisfaction */
    avgSatisfaction?: number;
    /** Sample size */
    sampleSize: number;
    /** Last updated */
    updatedAt: number;
}

// ============================================================================
// Self-Improvement Manager
// ============================================================================

/**
 * Manages agent self-improvement through learning.
 * 
 * Usage:
 * ```typescript
 * const improver = new SelfImprovementManager();
 * 
 * // Record an execution
 * improver.recordExecution({
 *   id: 'exec-1',
 *   agentId: 'react-agent',
 *   goal: 'Find childhood memories',
 *   outcome: ExecutionOutcome.SUCCESS,
 *   userSatisfaction: 4,
 *   ...
 * });
 * 
 * // Analyze patterns
 * const patterns = improver.analyzePatterns('react-agent');
 * 
 * // Get improvement suggestions
 * const suggestions = improver.generateSuggestions('react-agent');
 * ```
 */
export class SelfImprovementManager {
    private executions: Map<string, ExecutionRecord> = new Map();
    private patterns: Map<string, LearnedPattern> = new Map();
    private suggestions: ImprovementSuggestion[] = [];
    private baselines: Map<string, PerformanceBaseline> = new Map();

    // M5 hardening: Limits to prevent unbounded growth
    private readonly MAX_EXECUTIONS = 1000;
    private readonly MAX_PATTERNS = 100;
    private readonly MAX_SUGGESTIONS = 50;
    private readonly MAX_AGE_DAYS = 90;

    // ============================================================================
    // Execution Recording
    // ============================================================================

    /**
     * Record an execution for learning.
     */
    recordExecution(record: ExecutionRecord): void {
        this.executions.set(record.id, record);

        // M5 hardening: Auto-prune to prevent unbounded growth
        this.prune();

        // Update baseline
        this.updateBaseline(record);

        // Analyze for patterns
        this.detectPatterns(record);

        // Check for anomalies
        this.detectAnomalies(record);
    }

    /**
     * Add user feedback to an execution.
     */
    addUserFeedback(executionId: string, satisfaction: number, comments?: string): void {
        const record = this.executions.get(executionId);
        if (record) {
            record.userSatisfaction = satisfaction;
            if (comments) {
                record.contextFeatures['userComments'] = comments;
            }

            // Low satisfaction triggers pattern analysis
            if (satisfaction <= 2) {
                record.errorPatterns.push('low_user_satisfaction');
                this.detectPatterns(record);
            }
        }
    }

    // ============================================================================
    // Pattern Detection
    // ============================================================================

    /**
     * Analyze executions for patterns.
     */
    analyzePatterns(agentId?: string): LearnedPattern[] {
        const records = this.getExecutions(agentId);
        const patterns: LearnedPattern[] = [];

        // Analyze failure patterns
        const failures = records.filter((r) => r.outcome === ExecutionOutcome.FAILURE);
        if (failures.length >= 3) {
            const failurePattern = this.analyzeFailures(failures);
            if (failurePattern) {
                patterns.push(failurePattern);
                this.patterns.set(failurePattern.id, failurePattern);
            }
        }

        // Analyze success patterns
        const successes = records.filter((r) => r.outcome === ExecutionOutcome.SUCCESS);
        if (successes.length >= 3) {
            const successPattern = this.analyzeSuccesses(successes);
            if (successPattern) {
                patterns.push(successPattern);
                this.patterns.set(successPattern.id, successPattern);
            }
        }

        // Analyze timeout patterns
        const timeouts = records.filter((r) => r.outcome === ExecutionOutcome.TIMEOUT);
        if (timeouts.length >= 2) {
            const timeoutPattern = this.analyzeTimeouts(timeouts);
            if (timeoutPattern) {
                patterns.push(timeoutPattern);
                this.patterns.set(timeoutPattern.id, timeoutPattern);
            }
        }

        // Analyze cost patterns
        const costPattern = this.analyzeCostPatterns(records);
        if (costPattern) {
            patterns.push(costPattern);
            this.patterns.set(costPattern.id, costPattern);
        }

        return patterns;
    }

    /**
     * Detect patterns from a single execution.
     */
    private detectPatterns(record: ExecutionRecord): void {
        // Check for common error patterns
        if (record.outcome === ExecutionOutcome.FAILURE || record.outcome === ExecutionOutcome.ERROR) {
            // Tool-specific failures
            for (const tool of record.toolsUsed) {
                const toolFailures = Array.from(this.executions.values()).filter(
                    (r) =>
                        r.outcome === ExecutionOutcome.FAILURE &&
                        r.toolsUsed.includes(tool) &&
                        r.timestamp > Date.now() - 86400000 // Last 24 hours
                );

                if (toolFailures.length >= 3) {
                    const existingPattern = Array.from(this.patterns.values()).find(
                        (p) => p.type === 'failure' && p.description.includes(tool)
                    );

                    if (!existingPattern) {
                        const pattern: LearnedPattern = {
                            id: `pattern-tool-${tool}-${Date.now()}`,
                            type: 'failure',
                            description: `Tool ${tool} frequently fails`,
                            confidence: 0.7,
                            observationCount: toolFailures.length,
                            conditions: [{ feature: 'toolsUsed', operator: 'contains', value: tool }],
                            recommendation: `Consider alternative to ${tool} or add error handling`,
                            impactScore: 0,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        };
                        this.patterns.set(pattern.id, pattern);
                    }
                }
            }
        }
    }

    /**
     * Analyze failure patterns.
     */
    private analyzeFailures(failures: ExecutionRecord[]): LearnedPattern | null {
        if (failures.length < 3) return null;

        // Find common error patterns
        const errorCounts = new Map<string, number>();
        for (const record of failures) {
            for (const error of record.errorPatterns) {
                errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
            }
        }

        // Find most common error
        let mostCommon: string | null = null;
        let maxCount = 0;
        for (const [error, count] of errorCounts) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = error;
            }
        }

        if (mostCommon && maxCount >= 2) {
            return {
                id: `pattern-failure-${Date.now()}`,
                type: 'failure',
                description: `Common failure pattern: ${mostCommon}`,
                confidence: maxCount / failures.length,
                observationCount: failures.length,
                conditions: [{ feature: 'errorPatterns', operator: 'contains', value: mostCommon }],
                recommendation: this.getRecommendationForError(mostCommon),
                impactScore: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        }

        return null;
    }

    /**
     * Analyze success patterns.
     */
    private analyzeSuccesses(successes: ExecutionRecord[]): LearnedPattern | null {
        if (successes.length < 3) return null;

        // Find common tools in successful executions
        const toolCounts = new Map<string, number>();
        for (const record of successes) {
            for (const tool of record.toolsUsed) {
                toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
            }
        }

        // Find most common tool combination
        const successfulTools = Array.from(toolCounts.entries())
            .filter(([_, count]) => count >= successes.length * 0.5)
            .map(([tool]) => tool);

        if (successfulTools.length > 0) {
            return {
                id: `pattern-success-${Date.now()}`,
                type: 'success',
                description: `Successful pattern: use tools ${successfulTools.join(', ')}`,
                confidence: 0.7,
                observationCount: successes.length,
                conditions: successfulTools.map((tool) => ({
                    feature: 'toolsUsed',
                    operator: 'contains' as const,
                    value: tool,
                })),
                recommendation: `Prioritize using ${successfulTools.join(', ')} for similar goals`,
                impactScore: 0.5,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        }

        return null;
    }

    /**
     * Analyze timeout patterns.
     */
    private analyzeTimeouts(timeouts: ExecutionRecord[]): LearnedPattern | null {
        if (timeouts.length < 2) return null;

        const avgSteps = timeouts.reduce((sum, r) => sum + r.stepCount, 0) / timeouts.length;
        const avgTokens = timeouts.reduce((sum, r) => sum + r.tokenUsage, 0) / timeouts.length;

        return {
            id: `pattern-timeout-${Date.now()}`,
            type: 'optimization',
            description: `Timeout pattern: avg ${avgSteps.toFixed(1)} steps, ${avgTokens.toFixed(0)} tokens`,
            confidence: 0.6,
            observationCount: timeouts.length,
            conditions: [
                { feature: 'stepCount', operator: 'gt', value: avgSteps * 0.8 },
                { feature: 'tokenUsage', operator: 'gt', value: avgTokens * 0.8 },
            ],
            recommendation: 'Consider increasing timeout or reducing complexity',
            impactScore: 0.3,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    }

    /**
     * Analyze cost patterns.
     */
    private analyzeCostPatterns(records: ExecutionRecord[]): LearnedPattern | null {
        if (records.length < 5) return null;

        const avgCost = records.reduce((sum, r) => sum + r.costCents, 0) / records.length;
        const highCostRecords = records.filter((r) => r.costCents > avgCost * 1.5);

        if (highCostRecords.length >= 2) {
            // Find what's common in high-cost executions
            const commonGoalWords = this.findCommonWords(highCostRecords.map((r) => r.goal));

            return {
                id: `pattern-cost-${Date.now()}`,
                type: 'optimization',
                description: `High cost pattern for goals containing: ${commonGoalWords.join(', ')}`,
                confidence: 0.5,
                observationCount: highCostRecords.length,
                conditions: commonGoalWords.map((word) => ({
                    feature: 'goal',
                    operator: 'contains' as const,
                    value: word,
                })),
                recommendation: 'Use cheaper models or simplify for these goal types',
                impactScore: 0.4,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        }

        return null;
    }

    /**
     * Find common words across strings.
     */
    private findCommonWords(strings: string[]): string[] {
        if (strings.length === 0) return [];

        const wordCounts = new Map<string, number>();
        for (const str of strings) {
            const words = str.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
            const uniqueWords = new Set(words);
            for (const word of uniqueWords) {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            }
        }

        return Array.from(wordCounts.entries())
            .filter(([_, count]) => count >= strings.length * 0.5)
            .map(([word]) => word)
            .slice(0, 3);
    }

    /**
     * Get recommendation for an error pattern.
     */
    private getRecommendationForError(error: string): string {
        const recommendations: Record<string, string> = {
            low_user_satisfaction: 'Review response quality and consider more context retrieval',
            tool_not_found: 'Ensure tool availability or add fallback tools',
            timeout: 'Increase timeout or reduce step complexity',
            token_limit: 'Implement better context pruning',
            replan_limit: 'Improve initial planning or reduce plan complexity',
            default: 'Review execution logs for root cause',
        };
        return recommendations[error] || recommendations.default;
    }

    // ============================================================================
    // Anomaly Detection
    // ============================================================================

    /**
     * Detect anomalies in an execution.
     */
    private detectAnomalies(record: ExecutionRecord): void {
        const baseline = this.baselines.get(record.agentId);
        if (!baseline || baseline.sampleSize < 10) return;

        const anomalies: string[] = [];

        // Duration anomaly
        if (record.durationMs > baseline.avgDurationMs * 2) {
            anomalies.push('unusually_slow');
        }

        // Cost anomaly
        if (record.costCents > baseline.avgCostCents * 2) {
            anomalies.push('unusually_expensive');
        }

        // Token anomaly
        if (record.tokenUsage > baseline.avgTokens * 2) {
            anomalies.push('high_token_usage');
        }

        if (anomalies.length > 0) {
            record.errorPatterns.push(...anomalies);
        }
    }

    // ============================================================================
    // Suggestion Generation
    // ============================================================================

    /**
     * Generate improvement suggestions.
     */
    generateSuggestions(agentId?: string): ImprovementSuggestion[] {
        const patterns = Array.from(this.patterns.values());
        const suggestions: ImprovementSuggestion[] = [];

        // Convert patterns to suggestions
        for (const pattern of patterns) {
            if (pattern.confidence >= 0.5) {
                const suggestion: ImprovementSuggestion = {
                    id: `sug-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    category: this.categorizePattern(pattern),
                    priority: this.calculatePriority(pattern),
                    description: pattern.recommendation,
                    expectedImpact: `Address ${pattern.description}`,
                    confidence: pattern.confidence,
                    evidence: [],
                    createdAt: Date.now(),
                    status: 'pending',
                };
                suggestions.push(suggestion);
            }
        }

        // Sort by priority
        suggestions.sort((a, b) => b.priority - a.priority);

        this.suggestions = suggestions;
        return suggestions;
    }

    /**
     * Categorize a pattern.
     */
    private categorizePattern(pattern: LearnedPattern): ImprovementSuggestion['category'] {
        if (pattern.description.includes('timeout')) return 'timeout';
        if (pattern.description.includes('cost')) return 'cost';
        if (pattern.description.includes('tool')) return 'tool';
        if (pattern.description.includes('prompt') || pattern.description.includes('response')) return 'prompt';
        if (pattern.type === 'success') return 'strategy';
        return 'general';
    }

    /**
     * Calculate priority for a pattern.
     */
    private calculatePriority(pattern: LearnedPattern): number {
        let priority = 1;

        // Higher observation count = higher priority
        priority += Math.min(2, pattern.observationCount / 5);

        // Higher confidence = higher priority
        priority += pattern.confidence * 2;

        // Failure patterns are higher priority
        if (pattern.type === 'failure') priority += 1;

        return Math.min(5, Math.round(priority));
    }

    /**
     * Mark a suggestion as applied.
     */
    applySuggestion(suggestionId: string): void {
        const suggestion = this.suggestions.find((s) => s.id === suggestionId);
        if (suggestion) {
            suggestion.status = 'applied';
        }
    }

    /**
     * Mark a suggestion as rejected.
     */
    rejectSuggestion(suggestionId: string): void {
        const suggestion = this.suggestions.find((s) => s.id === suggestionId);
        if (suggestion) {
            suggestion.status = 'rejected';
        }
    }

    // ============================================================================
    // Baseline Management
    // ============================================================================

    /**
     * Update performance baseline.
     */
    private updateBaseline(record: ExecutionRecord): void {
        const key = record.agentId;
        const existing = this.baselines.get(key);

        if (!existing) {
            this.baselines.set(key, {
                agentId: record.agentId,
                window: 'rolling',
                successRate: record.outcome === ExecutionOutcome.SUCCESS ? 1 : 0,
                avgDurationMs: record.durationMs,
                avgTokens: record.tokenUsage,
                avgCostCents: record.costCents,
                avgSatisfaction: record.userSatisfaction,
                sampleSize: 1,
                updatedAt: Date.now(),
            });
            return;
        }

        // Exponential moving average
        const alpha = 0.1; // Weight for new observation
        const isSuccess = record.outcome === ExecutionOutcome.SUCCESS;

        existing.successRate = existing.successRate * (1 - alpha) + (isSuccess ? 1 : 0) * alpha;
        existing.avgDurationMs = existing.avgDurationMs * (1 - alpha) + record.durationMs * alpha;
        existing.avgTokens = existing.avgTokens * (1 - alpha) + record.tokenUsage * alpha;
        existing.avgCostCents = existing.avgCostCents * (1 - alpha) + record.costCents * alpha;

        if (record.userSatisfaction) {
            existing.avgSatisfaction = existing.avgSatisfaction
                ? existing.avgSatisfaction * (1 - alpha) + record.userSatisfaction * alpha
                : record.userSatisfaction;
        }

        existing.sampleSize++;
        existing.updatedAt = Date.now();
    }

    /**
     * Get baseline for an agent.
     */
    getBaseline(agentId: string): PerformanceBaseline | undefined {
        return this.baselines.get(agentId);
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * Get executions, optionally filtered.
     */
    getExecutions(agentId?: string): ExecutionRecord[] {
        const records = Array.from(this.executions.values());
        if (agentId) {
            return records.filter((r) => r.agentId === agentId);
        }
        return records;
    }

    /**
     * Get all patterns.
     */
    getPatterns(): LearnedPattern[] {
        return Array.from(this.patterns.values());
    }

    /**
     * Get suggestions.
     */
    getSuggestions(): ImprovementSuggestion[] {
        return this.suggestions;
    }

    /**
     * Clear all data.
     */
    clear(): void {
        this.executions.clear();
        this.patterns.clear();
        this.suggestions = [];
        this.baselines.clear();
    }

    /**
     * M5 hardening: Prune old records to prevent unbounded growth.
     * Removes records older than MAX_AGE_DAYS and caps total records.
     */
    prune(olderThanDays?: number): { prunedExecutions: number; prunedPatterns: number; prunedSuggestions: number } {
        const maxAgeMs = (olderThanDays ?? this.MAX_AGE_DAYS) * 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - maxAgeMs;
        let prunedExecutions = 0;
        let prunedPatterns = 0;
        let prunedSuggestions = 0;

        // Prune old executions
        for (const [id, record] of this.executions) {
            if (record.timestamp < cutoffTime) {
                this.executions.delete(id);
                prunedExecutions++;
            }
        }

        // Cap executions by count (keep most recent)
        if (this.executions.size > this.MAX_EXECUTIONS) {
            const sorted = Array.from(this.executions.entries())
                .sort((a, b) => b[1].timestamp - a[1].timestamp);
            const toRemove = sorted.slice(this.MAX_EXECUTIONS);
            for (const [id] of toRemove) {
                this.executions.delete(id);
                prunedExecutions++;
            }
        }

        // Prune old patterns
        for (const [id, pattern] of this.patterns) {
            if (pattern.updatedAt < cutoffTime) {
                this.patterns.delete(id);
                prunedPatterns++;
            }
        }

        // Cap patterns by count
        if (this.patterns.size > this.MAX_PATTERNS) {
            const sorted = Array.from(this.patterns.entries())
                .sort((a, b) => b[1].updatedAt - a[1].updatedAt);
            const toRemove = sorted.slice(this.MAX_PATTERNS);
            for (const [id] of toRemove) {
                this.patterns.delete(id);
                prunedPatterns++;
            }
        }

        // Cap suggestions
        if (this.suggestions.length > this.MAX_SUGGESTIONS) {
            const removed = this.suggestions.length - this.MAX_SUGGESTIONS;
            this.suggestions = this.suggestions
                .sort((a, b) => b.priority - a.priority)
                .slice(0, this.MAX_SUGGESTIONS);
            prunedSuggestions = removed;
        }

        return { prunedExecutions, prunedPatterns, prunedSuggestions };
    }
}
