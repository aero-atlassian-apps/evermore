/**
 * Agent State Machine - Explicit Finite State Machine for agent execution.
 * 
 * This FSM makes agent state transitions explicit and observable,
 * replacing implicit loop counters with a proper state machine.
 * 
 * @module AgentStateMachine
 */

import { AgentPhase, HaltReason, AgenticRunnerConfig } from '../primitives/AgentPrimitives';
import { AgentContext, AgentStep } from '../types';

// ============================================================================
// State Machine Types
// ============================================================================

/**
 * Context carried through state machine transitions.
 */
export interface StateMachineContext {
    /** Unique ID for this execution context */
    id?: string;
    /** Original goal */
    goal: string;
    /** Agent context */
    agentContext: AgentContext;
    /** All steps taken */
    steps: AgentStep[];
    /** Current step index */
    currentStepIndex: number;
    /** Token count */
    tokenCount: number;
    /** Cost in cents */
    costCents: number;
    /** Replan count */
    replanCount: number;
    /** Start time (epoch ms) */
    startTime: number;
    /** Last error, if any */
    lastError?: Error;
    /** Halt reason, if halted */
    haltReason?: HaltReason;
    /** Intermediate results */
    intermediateResults: Map<string, unknown>;
    /** Current execution plan */
    currentPlan?: unknown;
    /** Current reflection result */
    currentReflection?: unknown;
    /** Final answer */
    finalAnswer?: string;
}

/**
 * Definition of a state transition.
 */
export interface StateTransition {
    /** Source state */
    from: AgentPhase;
    /** Target state */
    to: AgentPhase;
    /** Trigger name (event) */
    trigger: string;
    /** Guard condition (returns true if transition allowed) */
    guard?: (context: StateMachineContext) => boolean;
    /** Action to perform during transition */
    action?: (context: StateMachineContext) => Promise<void>;
}

/**
 * Event that triggers a transition.
 */
export interface StateEvent {
    /** Event type */
    type: string;
    /** Event payload */
    payload?: unknown;
    /** Timestamp */
    timestamp: number;
}

/**
 * Listener for state transitions.
 */
export type TransitionListener = (
    from: AgentPhase,
    to: AgentPhase,
    trigger: string,
    context: StateMachineContext
) => void;

// ============================================================================
// State Machine Implementation
// ============================================================================

/**
 * Explicit Finite State Machine for agent execution.
 * 
 * States:
 * - IDLE: Initial state
 * - RECOGNIZING_INTENT: Extracting intent from user input
 * - DECOMPOSING_TASK: Breaking goal into sub-tasks
 * - PLANNING: Creating execution plan
 * - EXECUTING: Running a step
 * - OBSERVING: Processing step result
 * - REFLECTING: Validating against goal
 * - SYNTHESIZING: Creating final answer
 * - REPLANNING: Creating new plan after observation invalidation
 * - DONE: Successfully completed
 * - HALTED: Stopped due to limit/error
 * - ERROR: Unrecoverable error
 */
export class AgentStateMachine {
    private state: AgentPhase = AgentPhase.IDLE;
    private context: StateMachineContext;
    private transitions: StateTransition[];
    private listeners: TransitionListener[] = [];
    private eventHistory: StateEvent[] = [];
    private config: AgenticRunnerConfig;

    constructor(config: AgenticRunnerConfig, agentContext: AgentContext, goal: string) {
        this.config = config;
        this.context = this.createInitialContext(agentContext, goal);
        this.transitions = this.buildTransitions();
    }

    /**
     * Create initial state machine context.
     */
    private createInitialContext(agentContext: AgentContext, goal: string): StateMachineContext {
        return {
            goal,
            agentContext,
            steps: [],
            currentStepIndex: 0,
            tokenCount: 0,
            costCents: 0,
            replanCount: 0,
            startTime: Date.now(),
            intermediateResults: new Map(),
        };
    }

    /**
     * Build the transition table.
     */
    private buildTransitions(): StateTransition[] {
        return [
            // Start
            { from: AgentPhase.IDLE, to: AgentPhase.RECOGNIZING_INTENT, trigger: 'START' },

            // Intent Recognition
            { from: AgentPhase.RECOGNIZING_INTENT, to: AgentPhase.DECOMPOSING_TASK, trigger: 'INTENT_RECOGNIZED' },
            { from: AgentPhase.RECOGNIZING_INTENT, to: AgentPhase.SYNTHESIZING, trigger: 'SIMPLE_INTENT' },
            { from: AgentPhase.RECOGNIZING_INTENT, to: AgentPhase.ERROR, trigger: 'INTENT_ERROR' },

            // Task Decomposition
            { from: AgentPhase.DECOMPOSING_TASK, to: AgentPhase.PLANNING, trigger: 'TASK_DECOMPOSED' },
            { from: AgentPhase.DECOMPOSING_TASK, to: AgentPhase.SYNTHESIZING, trigger: 'SIMPLE_TASK' },
            { from: AgentPhase.DECOMPOSING_TASK, to: AgentPhase.ERROR, trigger: 'DECOMPOSITION_ERROR' },

            // Planning
            { from: AgentPhase.PLANNING, to: AgentPhase.EXECUTING, trigger: 'PLAN_READY' },
            { from: AgentPhase.PLANNING, to: AgentPhase.ERROR, trigger: 'PLAN_INVALID' },

            // Execution
            { from: AgentPhase.EXECUTING, to: AgentPhase.OBSERVING, trigger: 'STEP_COMPLETE' },
            { from: AgentPhase.EXECUTING, to: AgentPhase.HALTED, trigger: 'STEP_LIMIT', guard: this.guardStepLimit.bind(this) },
            { from: AgentPhase.EXECUTING, to: AgentPhase.HALTED, trigger: 'TIMEOUT', guard: this.guardTimeout.bind(this) },
            { from: AgentPhase.EXECUTING, to: AgentPhase.HALTED, trigger: 'TOKEN_LIMIT', guard: this.guardTokenLimit.bind(this) },
            { from: AgentPhase.EXECUTING, to: AgentPhase.HALTED, trigger: 'COST_LIMIT', guard: this.guardCostLimit.bind(this) },
            { from: AgentPhase.EXECUTING, to: AgentPhase.HALTED, trigger: 'SAFETY_HALT' },
            { from: AgentPhase.EXECUTING, to: AgentPhase.ERROR, trigger: 'STEP_ERROR' },

            // Observation
            { from: AgentPhase.OBSERVING, to: AgentPhase.EXECUTING, trigger: 'CONTINUE_PLAN' },
            { from: AgentPhase.OBSERVING, to: AgentPhase.REFLECTING, trigger: 'PLAN_COMPLETE' },
            { from: AgentPhase.OBSERVING, to: AgentPhase.REPLANNING, trigger: 'OBSERVATION_INVALIDATES' },

            // Replanning
            { from: AgentPhase.REPLANNING, to: AgentPhase.PLANNING, trigger: 'REPLAN_READY', guard: this.guardReplanLimit.bind(this) },
            { from: AgentPhase.REPLANNING, to: AgentPhase.HALTED, trigger: 'REPLAN_LIMIT' },

            // Reflection
            { from: AgentPhase.REFLECTING, to: AgentPhase.SYNTHESIZING, trigger: 'REFLECTION_COMPLETE' },
            { from: AgentPhase.REFLECTING, to: AgentPhase.REPLANNING, trigger: 'REFLECTION_INSUFFICIENT' },
            { from: AgentPhase.REFLECTING, to: AgentPhase.ERROR, trigger: 'REFLECTION_ERROR' },

            // Synthesis
            { from: AgentPhase.SYNTHESIZING, to: AgentPhase.DONE, trigger: 'ANSWER_READY' },
            { from: AgentPhase.SYNTHESIZING, to: AgentPhase.ERROR, trigger: 'SYNTHESIS_ERROR' },

            // Error Recovery
            { from: AgentPhase.ERROR, to: AgentPhase.SYNTHESIZING, trigger: 'RECOVER_WITH_FALLBACK' },
            { from: AgentPhase.ERROR, to: AgentPhase.HALTED, trigger: 'UNRECOVERABLE' },

            // External Halt
            { from: AgentPhase.RECOGNIZING_INTENT, to: AgentPhase.HALTED, trigger: 'USER_INTERRUPT' },
            { from: AgentPhase.DECOMPOSING_TASK, to: AgentPhase.HALTED, trigger: 'USER_INTERRUPT' },
            { from: AgentPhase.PLANNING, to: AgentPhase.HALTED, trigger: 'USER_INTERRUPT' },
            { from: AgentPhase.EXECUTING, to: AgentPhase.HALTED, trigger: 'USER_INTERRUPT' },
            { from: AgentPhase.OBSERVING, to: AgentPhase.HALTED, trigger: 'USER_INTERRUPT' },
            { from: AgentPhase.REFLECTING, to: AgentPhase.HALTED, trigger: 'USER_INTERRUPT' },
            { from: AgentPhase.SYNTHESIZING, to: AgentPhase.HALTED, trigger: 'USER_INTERRUPT' },
            { from: AgentPhase.REPLANNING, to: AgentPhase.HALTED, trigger: 'USER_INTERRUPT' },
        ];
    }

    // ============================================================================
    // Guard Conditions
    // ============================================================================

    private guardStepLimit(context: StateMachineContext): boolean {
        return context.steps.length >= this.config.maxSteps;
    }

    private guardTimeout(context: StateMachineContext): boolean {
        return (Date.now() - context.startTime) >= this.config.timeoutMs;
    }

    private guardTokenLimit(context: StateMachineContext): boolean {
        return context.tokenCount >= this.config.tokenBudget;
    }

    private guardCostLimit(context: StateMachineContext): boolean {
        return context.costCents >= this.config.costBudgetCents;
    }

    private guardReplanLimit(context: StateMachineContext): boolean {
        return context.replanCount < this.config.maxReplanAttempts;
    }

    // ============================================================================
    // Public API
    // ============================================================================

    /**
     * Get current state.
     */
    getState(): AgentPhase {
        return this.state;
    }

    /**
     * Get current context.
     */
    getContext(): StateMachineContext {
        return this.context;
    }

    /**
     * Check if the machine is in a terminal state.
     */
    isTerminal(): boolean {
        return [AgentPhase.DONE, AgentPhase.HALTED, AgentPhase.ERROR].includes(this.state);
    }

    /**
     * Check if a transition is valid from the current state.
     */
    canTransition(trigger: string): boolean {
        return this.transitions.some(
            (t) => t.from === this.state && t.trigger === trigger && (!t.guard || t.guard(this.context))
        );
    }

    /**
     * Get available transitions from current state.
     */
    getAvailableTransitions(): string[] {
        return this.transitions
            .filter((t) => t.from === this.state && (!t.guard || t.guard(this.context)))
            .map((t) => t.trigger);
    }

    /**
     * Attempt a state transition.
     */
    async transition(trigger: string, payload?: unknown): Promise<boolean> {
        const transition = this.transitions.find(
            (t) =>
                t.from === this.state &&
                t.trigger === trigger &&
                (!t.guard || t.guard(this.context))
        );

        if (!transition) {
            console.warn(
                `[AgentStateMachine] Invalid transition: ${this.state} --${trigger}--> ? (no matching transition)`
            );
            return false;
        }

        // Record event
        const event: StateEvent = {
            type: trigger,
            payload,
            timestamp: Date.now(),
        };
        this.eventHistory.push(event);

        // Execute action if defined
        if (transition.action) {
            try {
                await transition.action(this.context);
            } catch (error) {
                console.error(`[AgentStateMachine] Action failed for ${trigger}:`, error);
                this.context.lastError = error as Error;
                // Attempt ERROR transition
                if (this.canTransition('ERROR')) {
                    await this.transition('ERROR');
                }
                return false;
            }
        }

        // Perform transition
        const fromState = this.state;
        this.state = transition.to;

        // Notify listeners
        for (const listener of this.listeners) {
            try {
                listener(fromState, transition.to, trigger, this.context);
            } catch (error) {
                console.error('[AgentStateMachine] Listener error:', error);
            }
        }

        return true;
    }

    /**
     * Register a transition listener.
     */
    onTransition(listener: TransitionListener): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Update context (for external updates).
     */
    updateContext(updates: Partial<StateMachineContext>): void {
        this.context = { ...this.context, ...updates };
    }

    /**
     * Add a step to the context.
     */
    addStep(step: AgentStep): void {
        this.context.steps.push(step);
        this.context.currentStepIndex = this.context.steps.length;
    }

    /**
     * Add tokens and cost to the context.
     */
    recordUsage(tokens: number, costCents: number): void {
        this.context.tokenCount += tokens;
        this.context.costCents += costCents;
    }

    /**
     * Increment replan count.
     */
    recordReplan(): void {
        this.context.replanCount++;
    }

    /**
     * Set halt reason.
     */
    setHaltReason(reason: HaltReason): void {
        this.context.haltReason = reason;
    }

    /**
     * Set final answer.
     */
    setFinalAnswer(answer: string): void {
        this.context.finalAnswer = answer;
    }

    /**
     * Store intermediate result.
     */
    setIntermediateResult(key: string, value: unknown): void {
        this.context.intermediateResults.set(key, value);
    }

    /**
     * Get intermediate result.
     */
    getIntermediateResult<T>(key: string): T | undefined {
        return this.context.intermediateResults.get(key) as T | undefined;
    }

    /**
     * Get event history.
     */
    getEventHistory(): StateEvent[] {
        return [...this.eventHistory];
    }

    /**
     * Get elapsed time in milliseconds.
     */
    getElapsedMs(): number {
        return Date.now() - this.context.startTime;
    }

    /**
     * Check if any budget limit has been reached.
     */
    checkBudgetLimits(): HaltReason | null {
        if (this.guardStepLimit(this.context)) return HaltReason.MAX_STEPS;
        if (this.guardTimeout(this.context)) return HaltReason.TIMEOUT;
        if (this.guardTokenLimit(this.context)) return HaltReason.TOKEN_BUDGET;
        if (this.guardCostLimit(this.context)) return HaltReason.COST_BUDGET;
        return null;
    }

    /**
     * Create a snapshot of the current state for debugging.
     */
    snapshot(): {
        state: AgentPhase;
        stepsCount: number;
        tokenCount: number;
        costCents: number;
        replanCount: number;
        elapsedMs: number;
        availableTransitions: string[];
    } {
        return {
            state: this.state,
            stepsCount: this.context.steps.length,
            tokenCount: this.context.tokenCount,
            costCents: this.context.costCents,
            replanCount: this.context.replanCount,
            elapsedMs: this.getElapsedMs(),
            availableTransitions: this.getAvailableTransitions(),
        };
    }
}
