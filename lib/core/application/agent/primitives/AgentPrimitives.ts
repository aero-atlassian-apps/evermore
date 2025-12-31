/**
 * Agent Primitives - Core interfaces for the agentic AI system.
 * 
 * These primitives define the building blocks of reasoning agents.
 * Each interface represents a single cognitive responsibility,
 * enabling separation of concerns and testability.
 * 
 * @module AgentPrimitives
 */

import { AgentContext, AgentStep } from '../types';

// ============================================================================
// Intent Recognition
// ============================================================================

/**
 * Recognized intent from user input.
 * Provides structured understanding of what the user wants.
 */
export interface RecognizedIntent {
  /** Primary intent category */
  primaryIntent: IntentType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Extracted entities from the input */
  entities: Record<string, string>;
  /** Whether this intent requires memory lookup */
  requiresMemoryLookup: boolean;
  /** Whether this intent requires safety checking */
  requiresSafetyCheck: boolean;
  /** Secondary intents, if detected */
  secondaryIntents?: IntentType[];
  /** Raw reasoning from the LLM */
  reasoning?: string;
}

/**
 * Predefined intent categories for the Evermore system.
 */
export enum IntentType {
  /** User is sharing a memory or story */
  SHARE_MEMORY = 'SHARE_MEMORY',
  /** User is asking to recall a previous memory */
  RECALL_MEMORY = 'RECALL_MEMORY',
  /** User is expressing emotion */
  SHARE_EMOTION = 'SHARE_EMOTION',
  /** User is asking a question */
  ASK_QUESTION = 'ASK_QUESTION',
  /** User is providing clarification */
  CLARIFY = 'CLARIFY',
  /** User wants to change topic */
  CHANGE_TOPIC = 'CHANGE_TOPIC',
  /** User is greeting or making small talk */
  GREETING = 'GREETING',
  /** User wants to end the session */
  END_SESSION = 'END_SESSION',
  /** User is confused or needs help */
  CONFUSED = 'CONFUSED',
  /** Intent could not be determined */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Extracts structured intent from user input.
 */
export interface IntentRecognizer {
  /**
   * Recognize intent from user input.
   * @param input - Raw user input (text or normalized speech)
   * @param context - Current agent context
   * @returns Recognized intent with confidence
   */
  recognize(input: string, context: AgentContext): Promise<RecognizedIntent>;
}

// ============================================================================
// Task Decomposition (Algorithm of Thoughts)
// ============================================================================

/**
 * A single sub-task in a decomposition.
 */
export interface SubTask {
  /** Unique identifier for this sub-task */
  id: string;
  /** Human-readable description */
  description: string;
  /** Type of sub-task */
  type: SubTaskType;
  /** Required tool, if any */
  requiredTool?: string;
  /** Estimated complexity */
  complexity: 'low' | 'medium' | 'high';
  /** Whether this can be skipped on failure */
  optional: boolean;
}

export enum SubTaskType {
  /** Retrieve information */
  RETRIEVAL = 'RETRIEVAL',
  /** Perform analysis */
  ANALYSIS = 'ANALYSIS',
  /** Generate content */
  GENERATION = 'GENERATION',
  /** Validate or check something */
  VALIDATION = 'VALIDATION',
  /** Transform data */
  TRANSFORMATION = 'TRANSFORMATION',
  /** External tool call */
  TOOL_CALL = 'TOOL_CALL',
}

/**
 * Result of task decomposition.
 */
export interface TaskDecomposition {
  /** Ordered list of sub-tasks */
  subTasks: SubTask[];
  /** Dependencies between tasks (taskId -> dependsOn[]) */
  dependencies: Map<string, string[]>;
  /** Overall estimated complexity */
  estimatedComplexity: 'low' | 'medium' | 'high';
  /** Estimated token cost for execution */
  estimatedTokens?: number;
  /** Reasoning behind the decomposition */
  reasoning?: string;
}

/**
 * Decomposes a complex goal into atomic sub-tasks.
 * This is the "Algorithm of Thoughts" pattern.
 */
export interface TaskDecomposer {
  /**
   * Decompose a goal into sub-tasks.
   * @param goal - The high-level goal to achieve
   * @param context - Current agent context
   * @returns Task decomposition with dependencies
   */
  decompose(goal: string, context: AgentContext): Promise<TaskDecomposition>;
}

// ============================================================================
// Plan Generation
// ============================================================================

/**
 * A single step in an execution plan.
 */
export interface PlannedStep {
  /** Unique identifier */
  id: string;
  /** Step number in sequence */
  order: number;
  /** What action to take */
  action: string;
  /** Tool to use, if any */
  tool?: string;
  /** Input for the tool/action */
  input: Record<string, unknown>;
  /** Expected output type */
  expectedOutputType: string;
  /** Maximum retries for this step */
  maxRetries: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** What to do if this step fails */
  onFailure: 'abort' | 'skip' | 'retry' | 'fallback';
  /** Fallback action if onFailure is 'fallback' */
  fallbackAction?: string;
}

/**
 * Complete execution plan.
 */
export interface ExecutionPlan {
  /** Unique plan identifier */
  id: string;
  /** Original goal */
  goal: string;
  /** Ordered steps to execute */
  steps: PlannedStep[];
  /** Fallback plan if primary fails */
  fallbackPlan?: ExecutionPlan;
  /** Maximum total retries across all steps */
  maxRetries: number;
  /** Total timeout for plan execution */
  timeoutMs: number;
  /** Token budget for this plan */
  tokenBudget?: number;
  /** Cost budget in cents */
  costBudgetCents?: number;
}

/**
 * Result of plan validation.
 */
export interface PlanValidationResult {
  /** Whether the plan is valid */
  isValid: boolean;
  /** Validation errors, if any */
  errors: PlanValidationError[];
  /** Warnings (non-blocking issues) */
  warnings: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
}

export interface PlanValidationError {
  /** Which step has the error */
  stepId: string;
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
}

/**
 * Generates and validates execution plans.
 */
export interface PlanGenerator {
  /**
   * Generate a plan from a task decomposition.
   * @param decomposition - The task decomposition
   * @param constraints - Optional constraints (tokens, cost, time)
   * @returns Execution plan
   */
  generate(
    decomposition: TaskDecomposition,
    constraints?: PlanConstraints
  ): Promise<ExecutionPlan>;

  /**
   * Validate a plan for completeness and feasibility.
   * @param plan - The plan to validate
   * @returns Validation result
   */
  validate(plan: ExecutionPlan): Promise<PlanValidationResult>;
}

export interface PlanConstraints {
  maxSteps?: number;
  maxTokens?: number;
  maxCostCents?: number;
  maxTimeMs?: number;
  requiredTools?: string[];
  forbiddenTools?: string[];
}

// ============================================================================
// Step Execution
// ============================================================================

/**
 * Context for executing a step.
 */
export interface ExecutionContext {
  /** Current agent context */
  agentContext: AgentContext;
  /** Results from previous steps */
  previousResults: StepResult[];
  /** Accumulated observations */
  observations: ProcessedObservation[];
  /** Current token count */
  tokenCount: number;
  /** Current cost in cents */
  costCents: number;
}

/**
 * Result of executing a single step.
 */
export interface StepResult {
  /** Step that was executed */
  stepId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Output from the step */
  output: unknown;
  /** Error if failed */
  error?: string;
  /** Tokens used */
  tokensUsed: number;
  /** Cost in cents */
  costCents: number;
  /** Execution duration in ms */
  durationMs: number;
  /** Raw trace data for debugging */
  trace?: Record<string, unknown>;
}

/**
 * Executes individual steps in a plan.
 */
export interface StepExecutor {
  /**
   * Execute a single step.
   * @param step - The step to execute
   * @param context - Current execution context
   * @returns Step result
   */
  execute(step: PlannedStep, context: ExecutionContext): Promise<StepResult>;
}

// ============================================================================
// Observation Processing
// ============================================================================

/**
 * Processed observation from a step result.
 */
export interface ProcessedObservation {
  /** Which step this observation is from */
  stepId: string;
  /** Observation type */
  type: ObservationType;
  /** Key insight extracted */
  insight: string;
  /** Confidence in this observation */
  confidence: number;
  /** Whether this observation invalidates the current plan */
  invalidatesPlan: boolean;
  /** Suggested next action based on observation */
  suggestedAction?: string;
  /** Raw data from the step */
  rawData: unknown;
}

export enum ObservationType {
  /** Retrieved information */
  INFORMATION = 'INFORMATION',
  /** Confirmation of hypothesis */
  CONFIRMATION = 'CONFIRMATION',
  /** Contradiction of hypothesis */
  CONTRADICTION = 'CONTRADICTION',
  /** New unexpected information */
  DISCOVERY = 'DISCOVERY',
  /** Error or failure */
  ERROR = 'ERROR',
  /** Insufficient data */
  INSUFFICIENT = 'INSUFFICIENT',
}

/**
 * Processes step results into observations.
 */
export interface ObservationProcessor {
  /**
   * Process a step result into an observation.
   * @param result - The step result
   * @param context - Current execution context
   * @returns Processed observation
   */
  process(result: StepResult, context: ExecutionContext): Promise<ProcessedObservation>;

  /**
   * Determine if observations warrant replanning.
   * @param observation - The observation to check
   * @returns Whether to replan
   */
  shouldReplan(observation: ProcessedObservation): boolean;
}

// ============================================================================
// Reflection & Validation
// ============================================================================

/**
 * Result of reflecting on observations.
 */
export interface ReflectionResult {
  /** Whether the goal has been achieved */
  goalAchieved: boolean;
  /** Confidence in goal achievement */
  confidence: number;
  /** Summary of what was learned */
  summary: string;
  /** Key facts extracted */
  keyFacts: string[];
  /** Outstanding questions */
  outstandingQuestions: string[];
  /** Quality score (0-1) */
  qualityScore: number;
  /** Whether the result should be shown to user */
  readyForUser: boolean;
  /** Suggestions for improvement if not ready */
  improvementSuggestions?: string[];
}

/**
 * Validates and reflects on accumulated observations.
 */
export interface ReflectionValidator {
  /**
   * Validate observations against the original goal.
   * @param observations - Accumulated observations
   * @param goal - Original goal
   * @returns Reflection result
   */
  validate(
    observations: ProcessedObservation[],
    goal: string
  ): Promise<ReflectionResult>;
}

// ============================================================================
// Answer Synthesis
// ============================================================================

/**
 * Configuration for answer synthesis.
 */
export interface SynthesisConfig {
  /** Target audience */
  audience: 'senior' | 'family' | 'system';
  /** Desired tone */
  tone: 'empathetic' | 'informative' | 'casual' | 'formal';
  /** Maximum length in tokens */
  maxTokens?: number;
  /** Whether to include citations/references */
  includeCitations: boolean;
}

/**
 * Synthesizes final answers from reflections.
 */
export interface AnswerSynthesizer {
  /**
   * Synthesize a final answer from reflections.
   * @param reflections - Reflection results
   * @param context - Agent context
   * @param config - Synthesis configuration
   * @returns Synthesized answer text
   */
  synthesize(
    reflections: ReflectionResult,
    context: AgentContext,
    config?: SynthesisConfig
  ): Promise<string>;
}

// ============================================================================
// Composite Agent Runner
// ============================================================================

/**
 * Configuration for an agentic runner.
 */
export interface AgenticRunnerConfig {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Maximum steps before halting */
  maxSteps: number;
  /** Total timeout in milliseconds */
  timeoutMs: number;
  /** Token budget */
  tokenBudget: number;
  /** Cost budget in cents */
  costBudgetCents: number;
  /** Maximum replan attempts */
  maxReplanAttempts: number;
  /** Whether to use plan validation */
  validatePlans: boolean;
  /** System prompt ID (from registry) */
  systemPromptId: string;
  /** Available tool IDs */
  toolIds: string[];
}

/**
 * Result of an agentic run.
 */
export interface AgenticRunResult {
  /** Whether the run succeeded */
  success: boolean;
  /** Final answer */
  finalAnswer: string;
  /** All steps taken */
  steps: AgentStep[];
  /** All observations */
  observations: ProcessedObservation[];
  /** Final reflection */
  reflection?: ReflectionResult;
  /** Total tokens used */
  totalTokens: number;
  /** Total cost in cents */
  totalCostCents: number;
  /** Total duration in ms */
  durationMs: number;
  /** Halt reason if halted early */
  haltReason?: HaltReason;
  /** Trace ID for debugging */
  traceId: string;
}

export enum HaltReason {
  SUCCESS = 'SUCCESS',
  MAX_STEPS = 'MAX_STEPS',
  TIMEOUT = 'TIMEOUT',
  TOKEN_BUDGET = 'TOKEN_BUDGET',
  COST_BUDGET = 'COST_BUDGET',
  REPLAN_LIMIT = 'REPLAN_LIMIT',
  SAFETY_HALT = 'SAFETY_HALT',
  USER_INTERRUPT = 'USER_INTERRUPT',
  ERROR = 'ERROR',
}

/**
 * Complete agentic runner that composes all primitives.
 */
export interface AgenticRunner {
  /**
   * Run the agent to achieve a goal.
   * @param goal - The goal to achieve
   * @param context - Agent context
   * @returns Agentic run result
   */
  run(goal: string, context: AgentContext): Promise<AgenticRunResult>;

  /**
   * Get the current state (for monitoring).
   */
  getState(): AgentState;

  /**
   * Halt the agent gracefully.
   */
  halt(reason: HaltReason): Promise<void>;
}

/**
 * Agent state for monitoring.
 */
export interface AgentState {
  /** Current phase */
  phase: AgentPhase;
  /** Current step count */
  stepCount: number;
  /** Token count */
  tokenCount: number;
  /** Cost in cents */
  costCents: number;
  /** Start time */
  startTime: number;
  /** Is halted */
  isHalted: boolean;
  /** Last step result */
  lastStep?: AgentStep;
  /** Trace ID for this run */
  traceId: string;
}

export enum AgentPhase {
  IDLE = 'IDLE',
  RECOGNIZING_INTENT = 'RECOGNIZING_INTENT',
  DECOMPOSING_TASK = 'DECOMPOSING_TASK',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  OBSERVING = 'OBSERVING',
  REFLECTING = 'REFLECTING',
  SYNTHESIZING = 'SYNTHESIZING',
  REPLANNING = 'REPLANNING',
  DONE = 'DONE',
  HALTED = 'HALTED',
  ERROR = 'ERROR',
}
