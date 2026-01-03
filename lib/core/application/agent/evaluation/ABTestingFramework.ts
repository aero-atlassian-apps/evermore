/**
 * A/B Testing Framework - Statistical comparison of model variants.
 * 
 * Enables rigorous evaluation of model improvements by running
 * controlled experiments and measuring outcomes.
 * 
 * @module ABTestingFramework
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Experiment configuration.
 */
export interface ExperimentConfig {
    /** Unique experiment name */
    name: string;
    /** Description of what's being tested */
    description: string;
    /** Baseline model ID */
    baselineModel: string;
    /** Challenger model ID (e.g., DPO-tuned) */
    challengerModel: string;
    /** Traffic split for challenger (0-1) */
    trafficSplit: number;
    /** Metrics to track */
    metrics: string[];
    /** Start time */
    startTime: number;
    /** End time (optional, for scheduled experiments) */
    endTime?: number;
    /** Minimum samples per variant before analysis */
    minSamples: number;
}

/**
 * Experiment status.
 */
export enum ExperimentStatus {
    RUNNING = 'RUNNING',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    STOPPED = 'STOPPED',
}

/**
 * A recorded outcome for an experiment variant.
 */
export interface ExperimentOutcome {
    /** Experiment ID */
    experimentId: string;
    /** Variant (baseline or challenger) */
    variant: 'baseline' | 'challenger';
    /** User ID */
    userId: string;
    /** Timestamp */
    timestamp: number;
    /** Metric values */
    metrics: Record<string, number>;
    /** Execution ID (for traceability) */
    executionId?: string;
}

/**
 * Statistical analysis result.
 */
export interface ExperimentAnalysis {
    /** Experiment ID */
    experimentId: string;
    /** Which variant won */
    winner: 'baseline' | 'challenger' | 'inconclusive';
    /** Statistical confidence level (0-1) */
    confidenceLevel: number;
    /** Sample sizes */
    sampleSize: {
        baseline: number;
        challenger: number;
    };
    /** Per-metric comparison */
    metricsComparison: Record<string, MetricComparison>;
    /** Whether the result is statistically significant */
    significant: boolean;
    /** Human-readable summary */
    summary: string;
    /** Timestamp of analysis */
    analyzedAt: number;
}

/**
 * Comparison for a single metric.
 */
export interface MetricComparison {
    /** Baseline mean */
    baselineMean: number;
    /** Baseline standard deviation */
    baselineStd: number;
    /** Challenger mean */
    challengerMean: number;
    /** Challenger standard deviation */
    challengerStd: number;
    /** Relative improvement (%) */
    relativeImprovement: number;
    /** P-value from statistical test */
    pValue: number;
    /** Whether this metric shows significant improvement */
    significant: boolean;
}

/**
 * Active experiment state.
 */
export interface Experiment {
    /** Configuration */
    config: ExperimentConfig;
    /** Current status */
    status: ExperimentStatus;
    /** Outcomes recorded */
    outcomes: ExperimentOutcome[];
    /** User assignments (for consistent routing) */
    userAssignments: Map<string, 'baseline' | 'challenger'>;
    /** Created timestamp */
    createdAt: number;
    /** Last updated */
    updatedAt: number;
}

// ============================================================================
// A/B Testing Framework
// ============================================================================

/**
 * Manages A/B testing experiments for model comparison.
 * 
 * Usage:
 * ```typescript
 * const framework = new ABTestingFramework();
 * 
 * // Create experiment
 * const experiment = framework.createExperiment({
 *   name: 'dpo-v1-test',
 *   description: 'Testing DPO fine-tuned model',
 *   baselineModel: 'gemini-2.5-flash-lite',
 *   challengerModel: 'gemini-2.5-flash-dpo-tuned',
 *   trafficSplit: 0.5,
 *   metrics: ['satisfaction', 'responseTime', 'taskCompletion'],
 *   minSamples: 100,
 * });
 * 
 * // Route user to variant
 * const variant = framework.routeRequest('experiment-id', 'user-123');
 * // Returns 'baseline' or 'challenger'
 * 
 * // Record outcome
 * framework.recordOutcome('experiment-id', 'user-123', {
 *   satisfaction: 4.5,
 *   responseTime: 1200,
 *   taskCompletion: 1,
 * });
 * 
 * // Analyze results
 * const analysis = framework.analyzeExperiment('experiment-id');
 * ```
 */
export class ABTestingFramework {
    private experiments: Map<string, Experiment> = new Map();

    // ============================================================================
    // Experiment Management
    // ============================================================================

    /**
     * Create a new A/B test experiment.
     */
    createExperiment(config: Omit<ExperimentConfig, 'startTime'>): Experiment {
        const id = `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();

        const experiment: Experiment = {
            config: {
                ...config,
                startTime: now,
            },
            status: ExperimentStatus.RUNNING,
            outcomes: [],
            userAssignments: new Map(),
            createdAt: now,
            updatedAt: now,
        };

        this.experiments.set(id, experiment);
        console.log(`[ABTestingFramework] Created experiment: ${config.name} (${id})`);

        return experiment;
    }

    /**
     * Get experiment by ID.
     */
    getExperiment(experimentId: string): Experiment | undefined {
        return this.experiments.get(experimentId);
    }

    /**
     * Get active experiment (first running experiment).
     */
    getActiveExperiment(): { id: string; experiment: Experiment } | undefined {
        for (const [id, exp] of this.experiments) {
            if (exp.status === ExperimentStatus.RUNNING) {
                return { id, experiment: exp };
            }
        }
        return undefined;
    }

    /**
     * Pause an experiment.
     */
    pauseExperiment(experimentId: string): void {
        const exp = this.experiments.get(experimentId);
        if (exp) {
            exp.status = ExperimentStatus.PAUSED;
            exp.updatedAt = Date.now();
        }
    }

    /**
     * Resume a paused experiment.
     */
    resumeExperiment(experimentId: string): void {
        const exp = this.experiments.get(experimentId);
        if (exp && exp.status === ExperimentStatus.PAUSED) {
            exp.status = ExperimentStatus.RUNNING;
            exp.updatedAt = Date.now();
        }
    }

    /**
     * Stop an experiment.
     */
    stopExperiment(experimentId: string): void {
        const exp = this.experiments.get(experimentId);
        if (exp) {
            exp.status = ExperimentStatus.STOPPED;
            exp.updatedAt = Date.now();
        }
    }

    // ============================================================================
    // Traffic Routing
    // ============================================================================

    /**
     * Route a request to a variant (deterministic per user).
     */
    routeRequest(experimentId: string, userId: string): 'baseline' | 'challenger' {
        const exp = this.experiments.get(experimentId);
        if (!exp || exp.status !== ExperimentStatus.RUNNING) {
            return 'baseline'; // Default to baseline if no active experiment
        }

        // Check for existing assignment (consistency)
        const existing = exp.userAssignments.get(userId);
        if (existing) {
            return existing;
        }

        // Assign based on hash for determinism
        const hash = this.hashUserId(userId);
        const assignment = hash < exp.config.trafficSplit ? 'challenger' : 'baseline';

        exp.userAssignments.set(userId, assignment);
        exp.updatedAt = Date.now();

        return assignment;
    }

    /**
     * Hash user ID to a value between 0-1.
     */
    private hashUserId(userId: string): number {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash) / 0x7FFFFFFF;
    }

    // ============================================================================
    // Outcome Recording
    // ============================================================================

    /**
     * Record an outcome for an experiment.
     */
    recordOutcome(
        experimentId: string,
        userId: string,
        metrics: Record<string, number>,
        executionId?: string
    ): void {
        const exp = this.experiments.get(experimentId);
        if (!exp) {
            console.warn(`[ABTestingFramework] Experiment not found: ${experimentId}`);
            return;
        }

        const variant = exp.userAssignments.get(userId);
        if (!variant) {
            console.warn(`[ABTestingFramework] User not assigned to variant: ${userId}`);
            return;
        }

        const outcome: ExperimentOutcome = {
            experimentId,
            variant,
            userId,
            timestamp: Date.now(),
            metrics,
            executionId,
        };

        exp.outcomes.push(outcome);
        exp.updatedAt = Date.now();

        // Check if experiment has enough samples
        const baselineSamples = exp.outcomes.filter(o => o.variant === 'baseline').length;
        const challengerSamples = exp.outcomes.filter(o => o.variant === 'challenger').length;

        if (baselineSamples >= exp.config.minSamples && challengerSamples >= exp.config.minSamples) {
            if (exp.status === ExperimentStatus.RUNNING) {
                console.log(`[ABTestingFramework] Experiment ${experimentId} has enough samples for analysis`);
            }
        }
    }

    // ============================================================================
    // Statistical Analysis
    // ============================================================================

    /**
     * Analyze experiment results.
     */
    analyzeExperiment(experimentId: string): ExperimentAnalysis {
        const exp = this.experiments.get(experimentId);
        if (!exp) {
            throw new Error(`[ABTestingFramework] Experiment not found: ${experimentId}`);
        }

        const baselineOutcomes = exp.outcomes.filter(o => o.variant === 'baseline');
        const challengerOutcomes = exp.outcomes.filter(o => o.variant === 'challenger');

        const metricsComparison: Record<string, MetricComparison> = {};
        let significantWins = 0;
        let significantLosses = 0;

        for (const metric of exp.config.metrics) {
            const baselineValues = baselineOutcomes.map(o => o.metrics[metric]).filter(v => v !== undefined);
            const challengerValues = challengerOutcomes.map(o => o.metrics[metric]).filter(v => v !== undefined);

            const comparison = this.compareMetric(baselineValues, challengerValues);
            metricsComparison[metric] = comparison;

            if (comparison.significant) {
                if (comparison.relativeImprovement > 0) {
                    significantWins++;
                } else {
                    significantLosses++;
                }
            }
        }

        // Determine winner
        let winner: 'baseline' | 'challenger' | 'inconclusive' = 'inconclusive';
        const totalMetrics = exp.config.metrics.length;

        if (significantWins > totalMetrics / 2) {
            winner = 'challenger';
        } else if (significantLosses > totalMetrics / 2) {
            winner = 'baseline';
        }

        // Calculate overall confidence
        const significantCount = significantWins + significantLosses;
        const confidenceLevel = significantCount > 0
            ? Math.max(...Object.values(metricsComparison).map(m => 1 - m.pValue))
            : 0;

        const significant = confidenceLevel >= 0.95;

        const summary = this.generateSummary(
            winner,
            metricsComparison,
            baselineOutcomes.length,
            challengerOutcomes.length,
            exp.config
        );

        return {
            experimentId,
            winner,
            confidenceLevel,
            sampleSize: {
                baseline: baselineOutcomes.length,
                challenger: challengerOutcomes.length,
            },
            metricsComparison,
            significant,
            summary,
            analyzedAt: Date.now(),
        };
    }

    /**
     * Compare a single metric between variants.
     */
    private compareMetric(baseline: number[], challenger: number[]): MetricComparison {
        const baselineMean = this.mean(baseline);
        const baselineStd = this.std(baseline);
        const challengerMean = this.mean(challenger);
        const challengerStd = this.std(challenger);

        const relativeImprovement = baselineMean !== 0
            ? ((challengerMean - baselineMean) / baselineMean) * 100
            : 0;

        // Welch's t-test for unequal variances
        const pValue = this.welchTTest(baseline, challenger);
        const significant = pValue < 0.05;

        return {
            baselineMean,
            baselineStd,
            challengerMean,
            challengerStd,
            relativeImprovement,
            pValue,
            significant,
        };
    }

    /**
     * Calculate mean.
     */
    private mean(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    /**
     * Calculate standard deviation.
     */
    private std(values: number[]): number {
        if (values.length === 0) return 0;
        const avg = this.mean(values);
        const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
        return Math.sqrt(this.mean(squaredDiffs));
    }

    /**
     * Welch's t-test for comparing two samples.
     */
    private welchTTest(sample1: number[], sample2: number[]): number {
        if (sample1.length < 2 || sample2.length < 2) return 1.0;

        const n1 = sample1.length;
        const n2 = sample2.length;
        const mean1 = this.mean(sample1);
        const mean2 = this.mean(sample2);
        const var1 = Math.pow(this.std(sample1), 2);
        const var2 = Math.pow(this.std(sample2), 2);

        // Welch's t-statistic
        const t = (mean1 - mean2) / Math.sqrt(var1 / n1 + var2 / n2);

        // Degrees of freedom (Welch-Satterthwaite)
        const df = Math.pow(var1 / n1 + var2 / n2, 2) /
            (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

        // Approximate p-value using normal distribution for large samples
        const absT = Math.abs(t);
        const pValue = 2 * (1 - this.normalCDF(absT));

        return Math.max(0, Math.min(1, pValue));
    }

    /**
     * Normal CDF approximation.
     */
    private normalCDF(x: number): number {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return 0.5 * (1.0 + sign * y);
    }

    /**
     * Generate human-readable summary.
     */
    private generateSummary(
        winner: 'baseline' | 'challenger' | 'inconclusive',
        metrics: Record<string, MetricComparison>,
        baselineSamples: number,
        challengerSamples: number,
        config: ExperimentConfig
    ): string {
        const lines: string[] = [];

        lines.push(`## A/B Test Analysis: ${config.name}`);
        lines.push(`**Baseline**: ${config.baselineModel}`);
        lines.push(`**Challenger**: ${config.challengerModel}`);
        lines.push(`**Samples**: Baseline=${baselineSamples}, Challenger=${challengerSamples}`);
        lines.push('');

        if (winner === 'challenger') {
            lines.push('### 🏆 WINNER: Challenger (DPO-tuned model)');
        } else if (winner === 'baseline') {
            lines.push('### ⚠️ WINNER: Baseline (no improvement detected)');
        } else {
            lines.push('### ❓ INCONCLUSIVE: More samples needed');
        }

        lines.push('');
        lines.push('### Metric Breakdown');

        for (const [metric, comparison] of Object.entries(metrics)) {
            const arrow = comparison.relativeImprovement > 0 ? '↑' : (comparison.relativeImprovement < 0 ? '↓' : '→');
            const sig = comparison.significant ? '✓' : '';
            lines.push(`- **${metric}**: ${comparison.baselineMean.toFixed(2)} → ${comparison.challengerMean.toFixed(2)} (${arrow}${Math.abs(comparison.relativeImprovement).toFixed(1)}%) ${sig}`);
        }

        return lines.join('\n');
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * List all experiments.
     */
    listExperiments(): Array<{ id: string; experiment: Experiment }> {
        return Array.from(this.experiments.entries()).map(([id, experiment]) => ({
            id,
            experiment,
        }));
    }

    /**
     * Export experiment data.
     */
    exportExperiment(experimentId: string): any {
        const exp = this.experiments.get(experimentId);
        if (!exp) return null;

        return {
            config: exp.config,
            status: exp.status,
            outcomes: exp.outcomes,
            sampleSize: {
                baseline: exp.outcomes.filter(o => o.variant === 'baseline').length,
                challenger: exp.outcomes.filter(o => o.variant === 'challenger').length,
            },
            createdAt: exp.createdAt,
            updatedAt: exp.updatedAt,
        };
    }
}
