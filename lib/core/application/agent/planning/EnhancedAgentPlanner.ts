/**
 * Enhanced Agent Planner - Plan generation with validation and dependency graphs.
 * 
 * Implements sophisticated plan generation with:
 * - Schema validation for plans
 * - Step dependency resolution
 * - Cost/token estimation
 * - Feasibility checking
 * - Rollback capability
 * 
 * @module EnhancedAgentPlanner
 */

import { LLMPort } from '../../ports/LLMPort';
import { AgentContext } from '../types';
import {
    TaskDecomposition,
    ExecutionPlan,
    PlannedStep,
    PlanGenerator,
    PlanConstraints,
    PlanValidationResult,
    PlanValidationError,
} from '../primitives/AgentPrimitives';

// ============================================================================
// Types
// ============================================================================

/**
 * Dependency graph for plan steps.
 */
export interface StepDependencyGraph {
    /** Step ID to its dependencies */
    dependencies: Map<string, string[]>;
    /** Step ID to steps that depend on it */
    dependents: Map<string, string[]>;
    /** Topologically sorted step IDs */
    executionOrder: string[];
    /** Steps that can be parallelized */
    parallelGroups: string[][];
    /** Whether the graph has cycles */
    hasCycles: boolean;
    /** Critical path (longest chain) */
    criticalPath: string[];
}

/**
 * Plan rollback information.
 */
export interface RollbackInfo {
    /** Step ID */
    stepId: string;
    /** Rollback action */
    rollbackAction: string;
    /** Compensation data */
    compensationData: Record<string, unknown>;
    /** Whether rollback is possible */
    canRollback: boolean;
}

/**
 * Plan execution state.
 */
export interface PlanExecutionState {
    /** Plan ID */
    planId: string;
    /** Current step index */
    currentStepIndex: number;
    /** Completed step IDs */
    completedSteps: string[];
    /** Failed step IDs */
    failedSteps: string[];
    /** Skipped step IDs */
    skippedSteps: string[];
    /** Rollback history */
    rollbacks: RollbackInfo[];
    /** Whether plan is paused */
    isPaused: boolean;
    /** Checkpoint data for resume */
    checkpoint: Record<string, unknown>;
}

/**
 * Configuration for the enhanced planner.
 */
export interface EnhancedPlannerConfig {
    /** Whether to validate plans before returning */
    validatePlans: boolean;
    /** Whether to build dependency graphs */
    buildDependencyGraphs: boolean;
    /** Whether to estimate costs */
    estimateCosts: boolean;
    /** Default timeout per step */
    defaultStepTimeoutMs: number;
    /** Default max retries per step */
    defaultMaxRetries: number;
    /** Model for plan generation */
    plannerModel: string;
}

const DEFAULT_CONFIG: EnhancedPlannerConfig = {
    validatePlans: true,
    buildDependencyGraphs: true,
    estimateCosts: true,
    defaultStepTimeoutMs: 10000,
    defaultMaxRetries: 2,
    plannerModel: 'gemini-2.0-flash-lite-preview-02-05',
};

// ============================================================================
// Enhanced Agent Planner
// ============================================================================

/**
 * Advanced plan generator with validation and dependency management.
 * 
 * Usage:
 * ```typescript
 * const planner = new EnhancedAgentPlanner(llm);
 * 
 * const decomposition: TaskDecomposition = {
 *   originalGoal: 'Recall a childhood memory about summer',
 *   subTasks: [
 *     { id: '1', description: 'Search memories', ... },
 *     { id: '2', description: 'Synthesize response', ... },
 *   ],
 *   ...
 * };
 * 
 * const plan = await planner.generate(decomposition, {
 *   maxSteps: 5,
 *   maxTokens: 5000,
 * });
 * 
 * const validation = await planner.validate(plan);
 * if (!validation.isValid) {
 *   console.error('Plan issues:', validation.errors);
 * }
 * ```
 */
export class EnhancedAgentPlanner implements PlanGenerator {
    private llm: LLMPort;
    private config: EnhancedPlannerConfig;
    private executionStates: Map<string, PlanExecutionState> = new Map();

    constructor(llm: LLMPort, config?: Partial<EnhancedPlannerConfig>) {
        this.llm = llm;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ============================================================================
    // Plan Generation
    // ============================================================================

    /**
     * Generate an execution plan from a task decomposition.
     */
    async generate(
        decomposition: TaskDecomposition,
        constraints?: PlanConstraints
    ): Promise<ExecutionPlan> {
        // Build the planning prompt
        const prompt = this.buildPlanningPrompt(decomposition, constraints);

        // Generate plan via LLM
        const rawPlan = await this.llm.generateJson<{
            steps: Array<{
                id: string;
                action: string;
                tool?: string;
                input: Record<string, unknown>;
                expectedOutputType: string;
                dependsOn?: string[];
            }>;
        }>(prompt);

        // Convert to ExecutionPlan
        const steps: PlannedStep[] = rawPlan.steps.map((step, index) => ({
            id: step.id || `step-${index + 1}`,
            order: index + 1,
            action: step.action,
            tool: step.tool,
            input: step.input,
            expectedOutputType: step.expectedOutputType || 'string',
            maxRetries: this.config.defaultMaxRetries,
            timeoutMs: this.config.defaultStepTimeoutMs,
            onFailure: 'retry' as const,
        }));

        // Extract goal from first subtask description
        const goalDescription = decomposition.subTasks[0]?.description || 'Unknown goal';

        const plan: ExecutionPlan = {
            id: `plan-${Date.now()}`,
            goal: goalDescription,
            steps,
            maxRetries: constraints?.maxSteps || 3,
            timeoutMs: constraints?.maxTimeMs || 30000,
            tokenBudget: constraints?.maxTokens,
            costBudgetCents: constraints?.maxCostCents,
        };

        // Validate if configured
        if (this.config.validatePlans) {
            const validation = await this.validate(plan);
            if (!validation.isValid) {
                console.warn('[EnhancedAgentPlanner] Plan has validation errors:', validation.errors);
            }
        }

        return plan;
    }

    /**
     * Build the planning prompt.
     */
    private buildPlanningPrompt(
        decomposition: TaskDecomposition,
        constraints?: PlanConstraints
    ): string {
        const subTaskList = decomposition.subTasks
            .map((t) => `- ${t.id}: ${t.description} (type: ${t.type}, complexity: ${t.complexity})`)
            .join('\n');

        const constraintInfo = constraints
            ? `
CONSTRAINTS:
- Max steps: ${constraints.maxSteps || 'unlimited'}
- Max tokens: ${constraints.maxTokens || 'unlimited'}
- Max cost: ${constraints.maxCostCents ? constraints.maxCostCents + '¢' : 'unlimited'}
- Required tools: ${constraints.requiredTools?.join(', ') || 'none'}
- Forbidden tools: ${constraints.forbiddenTools?.join(', ') || 'none'}
`
            : '';

        // Extract goal from first subtask
        const goalDescription = decomposition.subTasks[0]?.description || 'Unknown goal';

        return `
You are a planning agent. Create an execution plan for the following goal.

GOAL: ${goalDescription}

SUB-TASKS:
${subTaskList}

REASONING USED:
${decomposition.reasoning || 'No reasoning provided'}
${constraintInfo}

Create a step-by-step execution plan. Each step should specify:
1. A unique ID
2. The action to take
3. Tool to use (if any)
4. Input parameters
5. Expected output type
6. Dependencies (which steps must complete first)

OUTPUT JSON:
{
  "steps": [
    {
      "id": "step-1",
      "action": "retrieve_memories",
      "tool": "RetrieveMemoriesTool",
      "input": { "query": "..." },
      "expectedOutputType": "array",
      "dependsOn": []
    },
    ...
  ]
}
`;
    }

    // ============================================================================
    // Plan Validation
    // ============================================================================

    /**
     * Validate a plan for completeness and feasibility.
     */
    async validate(plan: ExecutionPlan): Promise<PlanValidationResult> {
        const errors: PlanValidationError[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // Check for empty plan
        if (plan.steps.length === 0) {
            errors.push({
                stepId: 'plan',
                code: 'EMPTY_PLAN',
                message: 'Plan has no steps',
            });
        }

        // Check for duplicate IDs
        const stepIds = new Set<string>();
        for (const step of plan.steps) {
            if (stepIds.has(step.id)) {
                errors.push({
                    stepId: step.id,
                    code: 'DUPLICATE_ID',
                    message: `Duplicate step ID: ${step.id}`,
                });
            }
            stepIds.add(step.id);
        }

        // Check for missing actions
        for (const step of plan.steps) {
            if (!step.action || step.action.trim() === '') {
                errors.push({
                    stepId: step.id,
                    code: 'MISSING_ACTION',
                    message: `Step ${step.id} has no action defined`,
                });
            }
        }

        // Check for invalid timeouts
        for (const step of plan.steps) {
            if (step.timeoutMs <= 0) {
                warnings.push(`Step ${step.id} has invalid timeout: ${step.timeoutMs}ms`);
            }
        }

        // Build and check dependency graph
        if (this.config.buildDependencyGraphs) {
            const graph = this.buildDependencyGraph(plan);
            if (graph.hasCycles) {
                errors.push({
                    stepId: 'plan',
                    code: 'CYCLE_DETECTED',
                    message: 'Plan has circular dependencies',
                });
            }
        }

        // Cost estimation check
        if (plan.costBudgetCents && this.config.estimateCosts) {
            const estimatedCost = this.estimatePlanCost(plan);
            if (estimatedCost > plan.costBudgetCents) {
                warnings.push(`Estimated cost (${estimatedCost}¢) exceeds budget (${plan.costBudgetCents}¢)`);
                suggestions.push('Consider reducing the number of steps or using cheaper models');
            }
        }

        // Token budget check
        if (plan.tokenBudget) {
            const estimatedTokens = this.estimatePlanTokens(plan);
            if (estimatedTokens > plan.tokenBudget) {
                warnings.push(`Estimated tokens (${estimatedTokens}) exceeds budget (${plan.tokenBudget})`);
                suggestions.push('Consider simplifying step inputs or reducing context');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            suggestions,
        };
    }

    // ============================================================================
    // Dependency Graph
    // ============================================================================

    /**
     * Build a dependency graph for the plan.
     */
    buildDependencyGraph(plan: ExecutionPlan): StepDependencyGraph {
        const dependencies = new Map<string, string[]>();
        const dependents = new Map<string, string[]>();

        // Initialize maps
        for (const step of plan.steps) {
            dependencies.set(step.id, []);
            dependents.set(step.id, []);
        }

        // For now, assume steps are sequential (order-based dependencies)
        // In a real implementation, we would parse explicit dependencies
        for (let i = 1; i < plan.steps.length; i++) {
            const currentStep = plan.steps[i];
            const previousStep = plan.steps[i - 1];

            dependencies.get(currentStep.id)?.push(previousStep.id);
            dependents.get(previousStep.id)?.push(currentStep.id);
        }

        // Topological sort
        const { executionOrder, hasCycles } = this.topologicalSort(plan.steps, dependencies);

        // Find parallel groups (steps with same dependencies)
        const parallelGroups = this.findParallelGroups(plan.steps, dependencies);

        // Find critical path
        const criticalPath = this.findCriticalPath(plan.steps, dependencies);

        return {
            dependencies,
            dependents,
            executionOrder,
            parallelGroups,
            hasCycles,
            criticalPath,
        };
    }

    /**
     * Topological sort of steps.
     */
    private topologicalSort(
        steps: PlannedStep[],
        dependencies: Map<string, string[]>
    ): { executionOrder: string[]; hasCycles: boolean } {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const executionOrder: string[] = [];
        let hasCycles = false;

        const visit = (stepId: string): void => {
            if (visiting.has(stepId)) {
                hasCycles = true;
                return;
            }
            if (visited.has(stepId)) return;

            visiting.add(stepId);

            const deps = dependencies.get(stepId) || [];
            for (const dep of deps) {
                visit(dep);
            }

            visiting.delete(stepId);
            visited.add(stepId);
            executionOrder.push(stepId);
        };

        for (const step of steps) {
            visit(step.id);
        }

        return { executionOrder, hasCycles };
    }

    /**
     * Find groups of steps that can run in parallel.
     */
    private findParallelGroups(
        steps: PlannedStep[],
        dependencies: Map<string, string[]>
    ): string[][] {
        const groups: string[][] = [];
        const groupByLevel = new Map<number, string[]>();

        // Calculate level for each step (max dependency depth + 1)
        const levels = new Map<string, number>();

        const getLevel = (stepId: string): number => {
            if (levels.has(stepId)) return levels.get(stepId)!;

            const deps = dependencies.get(stepId) || [];
            if (deps.length === 0) {
                levels.set(stepId, 0);
                return 0;
            }

            const maxDepLevel = Math.max(...deps.map(getLevel));
            const level = maxDepLevel + 1;
            levels.set(stepId, level);
            return level;
        };

        for (const step of steps) {
            const level = getLevel(step.id);
            if (!groupByLevel.has(level)) {
                groupByLevel.set(level, []);
            }
            groupByLevel.get(level)!.push(step.id);
        }

        // Convert to array of groups
        const sortedLevels = Array.from(groupByLevel.keys()).sort((a, b) => a - b);
        for (const level of sortedLevels) {
            groups.push(groupByLevel.get(level)!);
        }

        return groups;
    }

    /**
     * Find the critical path (longest chain).
     */
    private findCriticalPath(
        steps: PlannedStep[],
        dependencies: Map<string, string[]>
    ): string[] {
        // Simple DFS to find longest path
        const memo = new Map<string, string[]>();

        const longestPath = (stepId: string): string[] => {
            if (memo.has(stepId)) return memo.get(stepId)!;

            const deps = dependencies.get(stepId) || [];
            if (deps.length === 0) {
                memo.set(stepId, [stepId]);
                return [stepId];
            }

            let longest: string[] = [];
            for (const dep of deps) {
                const path = longestPath(dep);
                if (path.length > longest.length) {
                    longest = path;
                }
            }

            const result = [...longest, stepId];
            memo.set(stepId, result);
            return result;
        };

        let criticalPath: string[] = [];
        for (const step of steps) {
            const path = longestPath(step.id);
            if (path.length > criticalPath.length) {
                criticalPath = path;
            }
        }

        return criticalPath;
    }

    // ============================================================================
    // Cost & Token Estimation
    // ============================================================================

    /**
     * Estimate the total cost of a plan.
     */
    estimatePlanCost(plan: ExecutionPlan): number {
        // Base cost per step (assuming Gemini 1.5 Pro pricing)
        const costPerStep = 0.1; // 10 cents per step as baseline
        return plan.steps.length * costPerStep;
    }

    /**
     * Estimate the total tokens for a plan.
     */
    estimatePlanTokens(plan: ExecutionPlan): number {
        // Estimate tokens per step based on input complexity
        let total = 0;
        for (const step of plan.steps) {
            const inputSize = JSON.stringify(step.input).length;
            const estimatedTokens = Math.ceil(inputSize / 4) + 500; // input + output estimate
            total += estimatedTokens;
        }
        return total;
    }

    // ============================================================================
    // Execution State Management
    // ============================================================================

    /**
     * Create execution state for a plan.
     */
    createExecutionState(plan: ExecutionPlan): PlanExecutionState {
        const state: PlanExecutionState = {
            planId: plan.id,
            currentStepIndex: 0,
            completedSteps: [],
            failedSteps: [],
            skippedSteps: [],
            rollbacks: [],
            isPaused: false,
            checkpoint: {},
        };
        this.executionStates.set(plan.id, state);
        return state;
    }

    /**
     * Get execution state for a plan.
     */
    getExecutionState(planId: string): PlanExecutionState | undefined {
        return this.executionStates.get(planId);
    }

    /**
     * Mark a step as completed.
     */
    completeStep(planId: string, stepId: string, result: unknown): void {
        const state = this.executionStates.get(planId);
        if (state) {
            state.completedSteps.push(stepId);
            state.currentStepIndex++;
            state.checkpoint[stepId] = result;
        }
    }

    /**
     * Mark a step as failed.
     */
    failStep(planId: string, stepId: string, error: Error): void {
        const state = this.executionStates.get(planId);
        if (state) {
            state.failedSteps.push(stepId);
            state.checkpoint[`${stepId}_error`] = error.message;
        }
    }

    /**
     * Pause plan execution.
     */
    pause(planId: string): void {
        const state = this.executionStates.get(planId);
        if (state) {
            state.isPaused = true;
        }
    }

    /**
     * Resume plan execution.
     */
    resume(planId: string): void {
        const state = this.executionStates.get(planId);
        if (state) {
            state.isPaused = false;
        }
    }

    /**
     * Record a rollback.
     */
    recordRollback(planId: string, rollback: RollbackInfo): void {
        const state = this.executionStates.get(planId);
        if (state) {
            state.rollbacks.push(rollback);
        }
    }

    /**
     * Clear execution state.
     */
    clearExecutionState(planId: string): void {
        this.executionStates.delete(planId);
    }

    // ============================================================================
    // Simple Plan Generation
    // ============================================================================

    /**
     * Create a simple linear plan from a goal (backwards compatibility).
     */
    async createSimplePlan(goal: string, _context: AgentContext): Promise<ExecutionPlan> {
        const decomposition: TaskDecomposition = {
            subTasks: [{
                id: 'main',
                description: goal,
                type: 'GENERATION' as any,
                complexity: 'medium',
                optional: false,
            }],
            dependencies: new Map(),
            estimatedComplexity: 'medium',
            reasoning: 'Simple single-task plan',
        };

        return this.generate(decomposition);
    }
}
