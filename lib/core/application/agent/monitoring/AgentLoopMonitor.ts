/**
 * Agent Loop Monitor - Bounds enforcement for agent execution.
 * 
 * Monitors step counts, token usage, cost, and time to ensure
 * agents operate within defined budgets and limits.
 * 
 * @module AgentLoopMonitor
 */

import { HaltReason, AgenticRunnerConfig } from '../primitives/AgentPrimitives';

// ============================================================================
// Monitor Types
// ============================================================================

/**
 * Configuration for the monitor.
 */
export interface MonitorConfig {
    /** Maximum steps before halting */
    maxSteps: number;
    /** Maximum execution time in milliseconds */
    maxTimeMs: number;
    /** Maximum tokens (input + output) */
    maxTokens: number;
    /** Maximum cost in cents */
    maxCostCents: number;
    /** Maximum replan attempts */
    maxReplanAttempts: number;
    /** Warning thresholds (percentage of max) */
    warningThresholds?: {
        steps?: number;
        time?: number;
        tokens?: number;
        cost?: number;
    };
}

/**
 * Current metrics tracked by the monitor.
 */
export interface MonitorMetrics {
    /** Number of steps executed */
    stepCount: number;
    /** Total input tokens */
    inputTokens: number;
    /** Total output tokens */
    outputTokens: number;
    /** Total tokens (input + output) */
    totalTokens: number;
    /** Total cost in cents */
    costCents: number;
    /** Number of replan attempts */
    replanCount: number;
    /** Elapsed time in milliseconds */
    elapsedMs: number;
    /** Start time (epoch ms) */
    startTime: number;
    /** Per-step breakdown */
    stepBreakdown: StepMetrics[];
}

/**
 * Metrics for a single step.
 */
export interface StepMetrics {
    /** Step identifier */
    stepId: string;
    /** Step name/type */
    stepName: string;
    /** Input tokens for this step */
    inputTokens: number;
    /** Output tokens for this step */
    outputTokens: number;
    /** Cost in cents for this step */
    costCents: number;
    /** Duration in milliseconds */
    durationMs: number;
    /** Model used */
    model?: string;
    /** Timestamp */
    timestamp: number;
}

/**
 * Warning emitted when approaching limits.
 */
export interface MonitorWarning {
    /** Warning type */
    type: 'steps' | 'time' | 'tokens' | 'cost';
    /** Current percentage of limit */
    percentage: number;
    /** Current value */
    current: number;
    /** Maximum value */
    max: number;
    /** Message */
    message: string;
    /** Timestamp */
    timestamp: number;
}

/**
 * Listener for monitor events.
 */
export type MonitorEventListener = (
    event: 'step' | 'warning' | 'halt',
    data: StepMetrics | MonitorWarning | HaltReason
) => void;

// ============================================================================
// Agent Loop Monitor
// ============================================================================

/**
 * Monitors agent execution and enforces limits.
 * 
 * Usage:
 * ```typescript
 * const monitor = new AgentLoopMonitor(config);
 * 
 * monitor.onEvent((event, data) => {
 *   if (event === 'warning') console.warn(data);
 * });
 * 
 * while (!monitor.shouldHalt()) {
 *   const step = await executeStep();
 *   monitor.recordStep({
 *     stepId: step.id,
 *     stepName: step.action,
 *     inputTokens: 100,
 *     outputTokens: 50,
 *     ...
 *   });
 * }
 * ```
 */
export class AgentLoopMonitor {
    private config: MonitorConfig;
    private metrics: MonitorMetrics;
    private listeners: MonitorEventListener[] = [];
    private warnings: MonitorWarning[] = [];
    private isHalted: boolean = false;
    private haltReason?: HaltReason;

    constructor(config: MonitorConfig | AgenticRunnerConfig) {
        this.config = this.normalizeConfig(config);
        this.metrics = this.createInitialMetrics();
    }

    /**
     * Normalize config to MonitorConfig format.
     */
    private normalizeConfig(config: MonitorConfig | AgenticRunnerConfig): MonitorConfig {
        if ('maxTimeMs' in config) {
            return config as MonitorConfig;
        }

        // Convert from AgenticRunnerConfig
        const runnerConfig = config as AgenticRunnerConfig;
        return {
            maxSteps: runnerConfig.maxSteps,
            maxTimeMs: runnerConfig.timeoutMs,
            maxTokens: runnerConfig.tokenBudget,
            maxCostCents: runnerConfig.costBudgetCents,
            maxReplanAttempts: runnerConfig.maxReplanAttempts,
            warningThresholds: {
                steps: 0.8,
                time: 0.8,
                tokens: 0.8,
                cost: 0.8,
            },
        };
    }

    /**
     * Create initial metrics object.
     */
    private createInitialMetrics(): MonitorMetrics {
        return {
            stepCount: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costCents: 0,
            replanCount: 0,
            elapsedMs: 0,
            startTime: Date.now(),
            stepBreakdown: [],
        };
    }

    // ============================================================================
    // Recording Methods
    // ============================================================================

    /**
     * Record a completed step.
     */
    recordStep(step: Omit<StepMetrics, 'timestamp'>): void {
        const stepWithTimestamp: StepMetrics = {
            ...step,
            timestamp: Date.now(),
        };

        this.metrics.stepCount++;
        this.metrics.inputTokens += step.inputTokens;
        this.metrics.outputTokens += step.outputTokens;
        this.metrics.totalTokens += step.inputTokens + step.outputTokens;
        this.metrics.costCents += step.costCents;
        this.metrics.stepBreakdown.push(stepWithTimestamp);
        this.updateElapsed();

        // Notify listeners
        this.emit('step', stepWithTimestamp);

        // Check for warnings
        this.checkWarnings();
    }

    /**
     * Record a replan attempt.
     */
    recordReplan(): void {
        this.metrics.replanCount++;
    }

    /**
     * Record token usage without a full step.
     */
    recordTokenUsage(inputTokens: number, outputTokens: number, model?: string): void {
        this.metrics.inputTokens += inputTokens;
        this.metrics.outputTokens += outputTokens;
        this.metrics.totalTokens += inputTokens + outputTokens;
        this.updateElapsed();
        this.checkWarnings();
    }

    /**
     * Record cost without a full step.
     */
    recordCost(costCents: number): void {
        this.metrics.costCents += costCents;
        this.updateElapsed();
        this.checkWarnings();
    }

    /**
     * Update elapsed time.
     */
    private updateElapsed(): void {
        this.metrics.elapsedMs = Date.now() - this.metrics.startTime;
    }

    // ============================================================================
    // Limit Checking
    // ============================================================================

    /**
     * Check if the agent should halt.
     */
    shouldHalt(): boolean {
        if (this.isHalted) return true;

        this.updateElapsed();
        const reason = this.checkLimits();

        if (reason) {
            this.halt(reason);
            return true;
        }

        return false;
    }

    /**
     * Check all limits and return halt reason if any exceeded.
     */
    checkLimits(): HaltReason | null {
        if (this.metrics.stepCount >= this.config.maxSteps) {
            return HaltReason.MAX_STEPS;
        }
        if (this.metrics.elapsedMs >= this.config.maxTimeMs) {
            return HaltReason.TIMEOUT;
        }
        if (this.metrics.totalTokens >= this.config.maxTokens) {
            return HaltReason.TOKEN_BUDGET;
        }
        if (this.metrics.costCents >= this.config.maxCostCents) {
            return HaltReason.COST_BUDGET;
        }
        if (this.metrics.replanCount >= this.config.maxReplanAttempts) {
            return HaltReason.REPLAN_LIMIT;
        }
        return null;
    }

    /**
     * Force halt with a reason.
     */
    halt(reason: HaltReason): void {
        if (this.isHalted) return;

        this.isHalted = true;
        this.haltReason = reason;
        this.emit('halt', reason);
    }

    /**
     * Get the halt reason if halted.
     */
    getHaltReason(): HaltReason | undefined {
        return this.haltReason;
    }

    // ============================================================================
    // Warning System
    // ============================================================================

    /**
     * Check for and emit warnings.
     */
    private checkWarnings(): void {
        const thresholds = this.config.warningThresholds || {};

        this.checkWarning('steps', this.metrics.stepCount, this.config.maxSteps, thresholds.steps);
        this.checkWarning('time', this.metrics.elapsedMs, this.config.maxTimeMs, thresholds.time);
        this.checkWarning('tokens', this.metrics.totalTokens, this.config.maxTokens, thresholds.tokens);
        this.checkWarning('cost', this.metrics.costCents, this.config.maxCostCents, thresholds.cost);
    }

    /**
     * Check a single warning threshold.
     */
    private checkWarning(
        type: 'steps' | 'time' | 'tokens' | 'cost',
        current: number,
        max: number,
        threshold?: number
    ): void {
        if (!threshold) return;

        const percentage = current / max;
        const alreadyWarned = this.warnings.some((w) => w.type === type);

        if (percentage >= threshold && !alreadyWarned) {
            const warning: MonitorWarning = {
                type,
                percentage: Math.round(percentage * 100),
                current,
                max,
                message: `${type} at ${Math.round(percentage * 100)}% of limit (${current}/${max})`,
                timestamp: Date.now(),
            };
            this.warnings.push(warning);
            this.emit('warning', warning);
        }
    }

    // ============================================================================
    // Event System
    // ============================================================================

    /**
     * Register an event listener.
     */
    onEvent(listener: MonitorEventListener): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) this.listeners.splice(index, 1);
        };
    }

    /**
     * Emit an event to all listeners.
     */
    private emit(
        event: 'step' | 'warning' | 'halt',
        data: StepMetrics | MonitorWarning | HaltReason
    ): void {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            } catch (error) {
                console.error('[AgentLoopMonitor] Listener error:', error);
            }
        }
    }

    // ============================================================================
    // Metrics Access
    // ============================================================================

    /**
     * Get current metrics.
     */
    getMetrics(): MonitorMetrics {
        this.updateElapsed();
        return { ...this.metrics, stepBreakdown: [...this.metrics.stepBreakdown] };
    }

    /**
     * Get all warnings.
     */
    getWarnings(): MonitorWarning[] {
        return [...this.warnings];
    }

    /**
     * Get remaining budget.
     */
    getRemainingBudget(): {
        steps: number;
        timeMs: number;
        tokens: number;
        costCents: number;
        replans: number;
    } {
        this.updateElapsed();
        return {
            steps: Math.max(0, this.config.maxSteps - this.metrics.stepCount),
            timeMs: Math.max(0, this.config.maxTimeMs - this.metrics.elapsedMs),
            tokens: Math.max(0, this.config.maxTokens - this.metrics.totalTokens),
            costCents: Math.max(0, this.config.maxCostCents - this.metrics.costCents),
            replans: Math.max(0, this.config.maxReplanAttempts - this.metrics.replanCount),
        };
    }

    /**
     * Get utilization percentages.
     */
    getUtilization(): {
        steps: number;
        time: number;
        tokens: number;
        cost: number;
        replans: number;
    } {
        this.updateElapsed();
        return {
            steps: (this.metrics.stepCount / this.config.maxSteps) * 100,
            time: (this.metrics.elapsedMs / this.config.maxTimeMs) * 100,
            tokens: (this.metrics.totalTokens / this.config.maxTokens) * 100,
            cost: (this.metrics.costCents / this.config.maxCostCents) * 100,
            replans: (this.metrics.replanCount / this.config.maxReplanAttempts) * 100,
        };
    }

    /**
     * Get average metrics per step.
     */
    getAverages(): {
        tokensPerStep: number;
        costPerStep: number;
        msPerStep: number;
    } | null {
        if (this.metrics.stepCount === 0) return null;

        return {
            tokensPerStep: this.metrics.totalTokens / this.metrics.stepCount,
            costPerStep: this.metrics.costCents / this.metrics.stepCount,
            msPerStep: this.metrics.elapsedMs / this.metrics.stepCount,
        };
    }

    /**
     * Estimate remaining capacity based on averages.
     */
    estimateCapacity(): {
        estimatedRemainingSteps: number;
        limitingFactor: 'steps' | 'time' | 'tokens' | 'cost' | 'replans';
    } | null {
        const remaining = this.getRemainingBudget();
        const averages = this.getAverages();

        if (!averages) {
            return {
                estimatedRemainingSteps: remaining.steps,
                limitingFactor: 'steps',
            };
        }

        const stepsByTokens = averages.tokensPerStep > 0
            ? remaining.tokens / averages.tokensPerStep
            : Infinity;
        const stepsByCost = averages.costPerStep > 0
            ? remaining.costCents / averages.costPerStep
            : Infinity;
        const stepsByTime = averages.msPerStep > 0
            ? remaining.timeMs / averages.msPerStep
            : Infinity;

        const estimates = [
            { factor: 'steps' as const, steps: remaining.steps },
            { factor: 'time' as const, steps: stepsByTime },
            { factor: 'tokens' as const, steps: stepsByTokens },
            { factor: 'cost' as const, steps: stepsByCost },
        ];

        const limiting = estimates.reduce((min, curr) =>
            curr.steps < min.steps ? curr : min
        );

        return {
            estimatedRemainingSteps: Math.floor(limiting.steps),
            limitingFactor: limiting.factor,
        };
    }

    /**
     * Create a summary for logging.
     */
    createSummary(): string {
        const m = this.getMetrics();
        const u = this.getUtilization();

        return [
            `Steps: ${m.stepCount}/${this.config.maxSteps} (${u.steps.toFixed(1)}%)`,
            `Tokens: ${m.totalTokens}/${this.config.maxTokens} (${u.tokens.toFixed(1)}%)`,
            `Cost: ${m.costCents}¢/${this.config.maxCostCents}¢ (${u.cost.toFixed(1)}%)`,
            `Time: ${m.elapsedMs}ms/${this.config.maxTimeMs}ms (${u.time.toFixed(1)}%)`,
            this.isHalted ? `HALTED: ${this.haltReason}` : 'Running',
        ].join(' | ');
    }

    /**
     * Reset the monitor for reuse.
     */
    reset(): void {
        this.metrics = this.createInitialMetrics();
        this.warnings = [];
        this.isHalted = false;
        this.haltReason = undefined;
    }
}
