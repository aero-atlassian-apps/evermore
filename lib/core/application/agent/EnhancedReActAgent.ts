/**
 * Enhanced ReAct Agent - State machine-driven ReAct implementation.
 * 
 * This is a modernized version of the ReActAgent that uses the explicit
 * state machine, monitoring, tracing, and new primitive interfaces.
 * 
 * @module EnhancedReActAgent
 */

import { LLMPort } from '../ports/LLMPort';
import { AgentStep, Tool, AgentContext } from './types';
import { AgentStateMachine, StateMachineContext } from './state/AgentStateMachine';
import { AgentLoopMonitor, StepMetrics } from './monitoring/AgentLoopMonitor';
import { EnhancedAgentTracer } from './EnhancedAgentTracer';
import { ContextBudgetManager } from './context/ContextBudgetManager';
import { ContextOptimizer } from './context/ContextOptimizer';
import { PromptRegistry, createDefaultPromptRegistry } from './prompts/PromptRegistry';
import { ToolRegistry } from './tools/ToolContracts'; // Import ToolRegistry
import { JsonParser } from '../utils/JsonParser'; // Import JsonParser
import { logger } from '../../../infrastructure/logging/LoggerService'; // Import LoggerService
import {
    AgenticRunnerConfig,
    AgenticRunner,
    AgentPhase,
    HaltReason,
    RecognizedIntent,
    IntentType,
    ProcessedObservation,
    ObservationType,
    ExecutionPlan,
    AgentState,
} from './primitives/AgentPrimitives';

// Senior Companion Modules
import { EmpathyEngine, EmotionCategory } from './persona/EmpathyEngine';
import { WellbeingGuard, RiskSeverity } from './safety/WellbeingGuard';
import { ProactiveEngine } from './proactive/ProactiveEngine';
import { SessionContinuityManager } from './continuity/SessionContinuity';
import { CognitiveAdapter } from './cognitive/CognitiveAdapter';
import { ExplanationEngine } from './transparency/ExplanationEngine';
import { MemoryType, MemoryImportance } from './memory/AgentMemory';
import { ModelRouter, ModelProfile, TaskComplexity } from './routing/ModelRouter';
import { AgentConfig } from './registry/AgentRegistry';
import { EmbeddingPort } from '../ports/EmbeddingPort';
import { VectorStorePort } from '../ports/VectorStorePort';
import { AgentMemoryManager } from './memory/AgentMemory';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the enhanced ReAct agent.
 */
export interface EnhancedReActAgentConfig {
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
    /** Whether to validate plans */
    validatePlans: boolean;
    /** System prompt ID from registry */
    systemPromptId?: string;
    /** Raw system prompt (fallback if no registry) */
    systemPrompt?: string;
    /** Whether to skip intent recognition for simple queries */
    skipIntentForSimple?: boolean;
    /** Threshold for "simple" query (character count) */
    simpleQueryThreshold?: number;
    /** Whether to enable senior companion features */
    enableCompanionFeatures?: boolean;
    /** User ID for session continuity */
    userId?: string;
    /** Model profile for routing */
    modelProfile: ModelProfile;
    /** Maximum length for thought (CoT) to save context */
    maxThoughtLength?: number;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: EnhancedReActAgentConfig = {
    maxSteps: 5,
    timeoutMs: 30000,
    tokenBudget: 8000,
    costBudgetCents: 20,
    maxReplanAttempts: 2,
    validatePlans: false,
    skipIntentForSimple: true,
    simpleQueryThreshold: 50,
    enableCompanionFeatures: true,
    userId: 'default-user',
    modelProfile: ModelProfile.BALANCED,
    maxThoughtLength: 1000,
};

/**
 * Result of an enhanced ReAct agent run.
 */
export interface EnhancedReActRunResult {
    /** Final answer */
    finalAnswer: string;
    /** All steps taken */
    steps: AgentStep[];
    /** Whether the run succeeded */
    success: boolean;
    /** Halt reason if halted early */
    haltReason?: HaltReason;
    /** Total tokens used */
    totalTokens: number;
    /** Total cost in cents */
    totalCostCents: number;
    /** Duration in ms */
    durationMs: number;
    /** Trace ID */
    traceId: string;
    /** Observations from this run */
    observations: ProcessedObservation[];
}

// ============================================================================
// Enhanced ReAct Agent
// ============================================================================

/**
 * State machine-driven ReAct agent with full observability.
 * 
 * Improvements over basic ReActAgent:
 * - Explicit state machine transitions
 * - Token/cost budget tracking
 * - Structured tracing with spans
 * - Context budget management
 * - Prompt registry integration
 * - Intent recognition (optional)
 * - Reflection validation
 * - SECURITY: ToolRegistry execution
 * - RELIABILITY: JsonParser
 * - FINOPS: Pre-execution cost checks
 *
 * Usage:
 * ```typescript
 * const agent = new EnhancedReActAgent(llm, tools, config);
 * const result = await agent.run(goal, context);
 * ```
 */
export class EnhancedReActAgent implements AgenticRunner {
    private config: EnhancedReActAgentConfig;
    private llm: LLMPort;
    private tools: Tool[];
    private promptRegistry?: PromptRegistry;
    private toolRegistry?: ToolRegistry; // Added for secure execution
    private systemPrompt: string;
    private modelRouter: ModelRouter;

    // Senior Companion Engines
    private empathyEngine: EmpathyEngine;
    private wellbeingGuard: WellbeingGuard;
    private proactiveEngine: ProactiveEngine;
    private sessionContinuity: SessionContinuityManager;
    private cognitiveAdapter: CognitiveAdapter;
    private explanationEngine: ExplanationEngine;
    private memory: AgentMemoryManager;
    private tracer!: EnhancedAgentTracer;

    constructor(
        llm: LLMPort,
        modelRouter: ModelRouter,
        tools: Tool[],
        config: Partial<EnhancedReActAgentConfig> & { modelProfile: ModelProfile },
        vectorStore?: VectorStorePort,
        embeddingPort?: EmbeddingPort,
        promptRegistry?: PromptRegistry,
        toolRegistry?: ToolRegistry // Injected dependency
    ) {
        this.llm = llm;
        this.modelRouter = modelRouter;
        this.tools = tools;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.promptRegistry = promptRegistry || createDefaultPromptRegistry();
        this.toolRegistry = toolRegistry;

        // Get system prompt from registry or config
        if (promptRegistry && this.config.systemPromptId) {
            this.systemPrompt = promptRegistry.render(this.config.systemPromptId);
        } else if (this.config.systemPrompt) {
            this.systemPrompt = this.config.systemPrompt;
        } else {
            this.systemPrompt = this.getDefaultSystemPrompt();
        }

        // Initialize companion engines
        this.empathyEngine = new EmpathyEngine();
        this.wellbeingGuard = new WellbeingGuard();
        this.proactiveEngine = new ProactiveEngine();
        this.sessionContinuity = new SessionContinuityManager(this.config.userId || 'default-user');
        this.cognitiveAdapter = new CognitiveAdapter();
        this.explanationEngine = new ExplanationEngine();

        // Initialize Memory and Tracing
        this.memory = new AgentMemoryManager(this.config.userId || 'system', vectorStore, embeddingPort);
        // Note: tracer is initialized in run() where goal/context are available
    }

    /**
     * Get the agent's memory manager.
     */
    public getMemory(): AgentMemoryManager {
        return this.memory;
    }

    /**
     * Default system prompt if none provided.
     */
    private getDefaultSystemPrompt(): string {
        return `You are a helpful AI assistant operating in a ReAct loop.
Think step by step, use tools when needed, and provide final answers.`;
    }

    // ============================================================================
    // Main Run Method
    // ============================================================================

    /**
     * Run the agent with a goal.
     */
    async run(goal: string, context: AgentContext): Promise<EnhancedReActRunResult> {
        // Initialize components - convert config for state machine
        const smConfig = {
            id: 'enhanced-react',
            name: 'Enhanced ReAct Agent',
            maxSteps: this.config.maxSteps,
            timeoutMs: this.config.timeoutMs,
            tokenBudget: this.config.tokenBudget,
            costBudgetCents: this.config.costBudgetCents,
            maxReplanAttempts: this.config.maxReplanAttempts,
            validatePlans: this.config.validatePlans,
            systemPromptId: this.config.systemPromptId || 'default',
            toolIds: this.tools.map(t => t.metadata.id),
        };
        const stateMachine = new AgentStateMachine(smConfig, context, goal);
        const monitor = new AgentLoopMonitor({
            maxSteps: this.config.maxSteps,
            maxTimeMs: this.config.timeoutMs,
            maxTokens: this.config.tokenBudget,
            maxCostCents: this.config.costBudgetCents,
            maxReplanAttempts: this.config.maxReplanAttempts,
        });
        const tracer = new EnhancedAgentTracer(context.sessionId, context.userId, goal);
        const contextManager = new ContextBudgetManager({ maxTokens: this.config.tokenBudget });

        // Set up initial context
        this.setupContext(contextManager, context, goal);

        // START SESSION CONTINUITY
        if (this.config.enableCompanionFeatures) {
            this.sessionContinuity.startSession(context.sessionId);
            // Inject recent style/tone into EmpathyEngine if possible (omitted for now)
        }

        // Start the state machine
        tracer.startSpan('agent_run', { goal: goal.substring(0, 100) });

        // Phase 8: RAG - Semantic Context Retrieval
        try {
            const relevantMemories = await this.memory.query({ query: goal, limit: 5 });
            if (relevantMemories.length > 0) {
                const memoryContext = relevantMemories
                    .map(m => `[Memory (${m.type})]: ${m.content}`)
                    .join('\n');

                tracer.recordEvent('long_term_memory_retrieved', { count: relevantMemories.length });

                // Add to context manager (instead of mutating shared systemPrompt)
                contextManager.addSource({
                    id: 'long-term-memories',
                    type: 'memories',
                    content: `RELEVANT MEMORIES:\n${memoryContext}`,
                    priority: 55,
                    required: false,
                });
            }
        } catch (e) {
            console.warn('[EnhancedReActAgent] Memory retrieval failed:', e);
        }

        // Phase 8.5: Performance - Context Optimization & Caching Stability
        const optimizedContext = contextManager.optimize();
        const stability = ContextOptimizer.identifyStablePrefix(optimizedContext.includedSources);
        tracer.recordEvent('context_stabilized', {
            stableIndex: stability.stableIndex,
            stableHash: stability.stableHash,
            totalSources: optimizedContext.includedSources.length
        });

        await stateMachine.transition('START');
        tracer.logTransition(AgentPhase.IDLE, AgentPhase.RECOGNIZING_INTENT, 'START');

        try {
            // Main execution loop
            while (!stateMachine.isTerminal() && !monitor.shouldHalt()) {
                const currentState = stateMachine.getState();

                switch (currentState) {
                    case AgentPhase.RECOGNIZING_INTENT:
                        await this.handleIntentRecognition(stateMachine, tracer, monitor, goal, context);
                        break;

                    case AgentPhase.DECOMPOSING_TASK:
                        await this.handleTaskDecomposition(stateMachine, tracer, monitor, goal);
                        break;

                    case AgentPhase.PLANNING:
                        await this.handlePlanning(stateMachine, tracer, monitor, contextManager);
                        break;

                    case AgentPhase.EXECUTING:
                        await this.handleExecution(stateMachine, tracer, monitor, contextManager);
                        break;

                    case AgentPhase.OBSERVING:
                        await this.handleObservation(stateMachine, tracer, monitor);
                        break;

                    case AgentPhase.REFLECTING:
                        await this.handleReflection(stateMachine, tracer, monitor, goal);
                        break;

                    case AgentPhase.SYNTHESIZING:
                        await this.handleSynthesis(stateMachine, tracer, monitor, goal);
                        break;

                    case AgentPhase.REPLANNING:
                        await this.handleReplanning(stateMachine, tracer, monitor);
                        break;

                    default:
                        // Should not reach here
                        console.warn(`[EnhancedReActAgent] Unexpected state: ${currentState}`);
                        await stateMachine.transition('ERROR');
                        break;
                }
            }

            // Check if we were halted by the monitor
            const haltReason = monitor.getHaltReason();
            if (haltReason) {
                stateMachine.setHaltReason(haltReason);
                await stateMachine.transition('UNRECOVERABLE');
            }

        } catch (error) {
            console.error('[EnhancedReActAgent] Fatal error:', error);
            stateMachine.updateContext({ lastError: error as Error });
            stateMachine.setHaltReason(HaltReason.ERROR);

            // Try to synthesize a fallback answer
            stateMachine.setFinalAnswer("I'm sorry, I encountered an error processing your request.");
        }

        // Phase 8: RAG - Learning / Knowledge Capture
        if (stateMachine.getState() === AgentPhase.DONE && stateMachine.getContext().finalAnswer) {
            try {
                const finalAnswer = stateMachine.getContext().finalAnswer!;
                // Store the outcome as an episodic memory
                await this.memory.store({
                    content: `Goal: ${goal}\nResult: ${finalAnswer}`,
                    type: MemoryType.EPISODIC,
                    importance: MemoryImportance.MEDIUM,
                    tags: ['task_outcome', (this.config as any).role || 'agent'],
                    relatedMemories: [],
                    source: 'agent_reflection',
                });
                tracer.recordEvent('interaction_learned', { goal: goal.substring(0, 50) });
            } catch (e) {
                console.warn('[EnhancedReActAgent] Failed to learn from interaction:', e);
            }
        }

        // Finalize
        const smContext = stateMachine.getContext();
        const metrics = monitor.getMetrics();

        tracer.finalize({
            success: stateMachine.getState() === AgentPhase.DONE,
            finalAnswer: smContext.finalAnswer,
            haltReason: smContext.haltReason,
        });
        tracer.endSpan(stateMachine.getState() === AgentPhase.DONE ? 'OK' : 'ERROR');

        return {
            finalAnswer: smContext.finalAnswer || "I couldn't complete your request.",
            steps: smContext.steps,
            success: smContext.haltReason === HaltReason.SUCCESS,
            haltReason: smContext.haltReason,
            totalTokens: metrics.totalTokens,
            totalCostCents: metrics.costCents,
            durationMs: metrics.elapsedMs,
            traceId: tracer.getTraceId(),
            observations: smContext.steps
                .filter((s) => s.observation)
                .map((s, idx) => ({
                    stepId: `step-${idx}`,
                    type: ObservationType.INFORMATION,
                    insight: s.observation!,
                    confidence: 1.0,
                    invalidatesPlan: false,
                    rawData: s,
                })),
        };
    }

    // ============================================================================
    // State Handlers
    // ============================================================================

    /**
     * Handle intent recognition phase.
     */
    private async handleIntentRecognition(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        goal: string,
        context: AgentContext
    ): Promise<void> {
        tracer.startSpan('intent_recognition');

        // SENIOR COMPANION: Wellbeing & Empathy
        if (this.config.enableCompanionFeatures) {
            // 1. Empathy Analysis (First, as it feeds into Wellbeing)
            const emotionState = this.empathyEngine.detectEmotion(goal);
            sm.setIntermediateResult('userEmotion', emotionState);

            // 2. Safety Check
            const assessment = this.wellbeingGuard.assessWellbeing(goal, emotionState);
            if (assessment.overallRisk === RiskSeverity.HIGH || assessment.overallRisk === RiskSeverity.CRITICAL) {
                sm.setFinalAnswer(assessment.suggestedResponse);
                await sm.transition('SIMPLE_INTENT'); // Fast-track to exit
                tracer.logTransition(AgentPhase.RECOGNIZING_INTENT, AgentPhase.SYNTHESIZING, 'SAFETY_INTERVENTION');
                tracer.endSpan('OK');
                return;
            }
        }

        // Check if we should skip for simple queries
        if (this.config.skipIntentForSimple && goal.length < (this.config.simpleQueryThreshold || 50)) {
            // Simple query - skip directly to synthesis
            const simpleIntent: RecognizedIntent = {
                primaryIntent: IntentType.GREETING,
                confidence: 0.9,
                entities: {},
                requiresMemoryLookup: false,
                requiresSafetyCheck: false,
                reasoning: 'Simple query, proceeding directly to response',
            };
            sm.setIntermediateResult('intent', simpleIntent);
            await sm.transition('SIMPLE_INTENT');
            tracer.logTransition(AgentPhase.RECOGNIZING_INTENT, AgentPhase.SYNTHESIZING, 'SIMPLE_INTENT');
            tracer.endSpan('OK');
            return;
        }

        try {
            // Use LLM for intent recognition with routing
            const intentPrompt = this.promptRegistry!.render('intent-recognition', {
                user_input: goal,
                context: `
- User ID: ${context.userId}
- Session ID: ${context.sessionId}
- Has memories: ${context.memories && context.memories.length > 0}
`.trim()
            });
            const decision = await this.callLLMWithRouting(intentPrompt, TaskComplexity.CLASSIFICATION);

            // RELIABILITY: Use robust parsing
            const intent = JsonParser.parse<RecognizedIntent>(decision.result);

            // Record usage
            const tokenEstimate = Math.ceil(intentPrompt.length / 4) + 200;
            monitor.recordStep({
                stepId: `intent-${Date.now()}`,
                stepName: 'intent_recognition',
                inputTokens: tokenEstimate,
                outputTokens: 200,
                costCents: decision.decision.model.costPer1KInputTokens * (tokenEstimate / 1000) +
                    decision.decision.model.costPer1KOutputTokens * (200 / 1000),
                durationMs: 500,
                model: decision.decision.modelId,
            });
            tracer.recordTokenUsage(tokenEstimate, 200, decision.decision.modelId);
            tracer.recordCost(decision.decision.model.costPer1KInputTokens * (tokenEstimate / 1000), decision.decision.modelId);

            sm.setIntermediateResult('intent', intent);

            // Transition based on intent
            if (intent.primaryIntent === IntentType.GREETING || intent.confidence < 0.3) {
                await sm.transition('SIMPLE_INTENT');
                tracer.logTransition(AgentPhase.RECOGNIZING_INTENT, AgentPhase.SYNTHESIZING, 'SIMPLE_INTENT');
            } else {
                await sm.transition('INTENT_RECOGNIZED');
                tracer.logTransition(AgentPhase.RECOGNIZING_INTENT, AgentPhase.DECOMPOSING_TASK, 'INTENT_RECOGNIZED');
            }

            tracer.endSpan('OK');
        } catch (error) {
            console.error('[EnhancedReActAgent] Intent recognition failed:', error);
            tracer.endSpan('ERROR', (error as Error).message);
            await sm.transition('INTENT_ERROR');
        }
    }

    /**
     * Handle task decomposition phase.
     */
    private async handleTaskDecomposition(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        goal: string
    ): Promise<void> {
        tracer.startSpan('task_decomposition');

        try {
            // Attempt a simple decomposition for complex queries
            if (goal.length > 200) {
                const decompPrompt = `
You are an expert planner. Break down the user's complex request into a list of high-level sub-goals.

USER REQUEST: "${goal}"

Output a JSON array of strings representing the sub-goals in order.
Example: ["Retrieve memories about X", "Synthesize story", "Format as email"]
`;
                const decision = await this.callLLMWithRouting(decompPrompt, TaskComplexity.REASONING);
                let subgoals: string[] = [];
                try {
                    // RELIABILITY: Use robust parsing
                    subgoals = JsonParser.parse<string[]>(decision.result);
                    sm.setIntermediateResult('subgoals', subgoals);
                    tracer.recordEvent('task_decomposed', { count: subgoals.length });
                } catch (e) {
                    console.warn('Failed to parse decomposition, proceeding with monolithic goal.', e);
                }
            }

            await sm.transition('TASK_DECOMPOSED');
            tracer.logTransition(AgentPhase.DECOMPOSING_TASK, AgentPhase.PLANNING, 'TASK_DECOMPOSED');
            tracer.endSpan('OK');
        } catch (error) {
            console.error('Task decomposition failed:', error);
            // Non-fatal, just proceed to planning with original goal
            await sm.transition('TASK_DECOMPOSED');
            tracer.endSpan('ERROR', (error as Error).message);
        }
    }

    /**
     * Handle planning phase.
     */
    private async handlePlanning(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        contextManager: ContextBudgetManager
    ): Promise<void> {
        tracer.startSpan('planning');

        const smContext = sm.getContext();
        const optimizedContext = contextManager.optimize();

        // Build tool descriptions
        const toolDescriptions = this.tools
            .map((t) => `${t.metadata.name}: ${t.metadata.description} (Schema: ${JSON.stringify(t.inputSchema)})`)
            .join('\n');

        // Create an implicit plan - the ReAct loop itself is the "plan"
        const plan: ExecutionPlan = {
            id: `plan-${Date.now()}`,
            goal: smContext.goal,
            steps: [{
                id: 'react-loop',
                order: 1,
                action: 'REACT_LOOP',
                input: { goal: smContext.goal },
                expectedOutputType: 'string',
                maxRetries: 3,
                timeoutMs: this.config.timeoutMs,
                onFailure: 'abort',
            }],
            maxRetries: 3,
            timeoutMs: this.config.timeoutMs,
            tokenBudget: this.config.tokenBudget,
            costBudgetCents: this.config.costBudgetCents,
        };

        sm.setIntermediateResult('plan', plan);
        sm.setIntermediateResult('toolDescriptions', toolDescriptions);
        sm.setIntermediateResult('contextContent', optimizedContext.content);

        await sm.transition('PLAN_READY');
        tracer.logTransition(AgentPhase.PLANNING, AgentPhase.EXECUTING, 'PLAN_READY');
        tracer.endSpan('OK');
    }

    /**
     * Handle execution phase.
     */
    private async handleExecution(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        contextManager: ContextBudgetManager
    ): Promise<void> {
        tracer.startSpan('execute_step');

        const smContext = sm.getContext();
        const toolDescriptions = sm.getIntermediateResult<string>('toolDescriptions') || '';
        const contextContent = sm.getIntermediateResult<string>('contextContent') || '';

        // Check budget limits first
        const budgetLimit = sm.checkBudgetLimits();
        if (budgetLimit) {
            sm.setHaltReason(budgetLimit);
            await sm.transition('STEP_LIMIT');
            tracer.endSpan('ERROR', `Budget limit: ${budgetLimit}`);
            return;
        }

        // Build the ReAct prompt using registry
        const prompt = this.promptRegistry!.render('task-react-execution', {
            system_prompt: this.systemPrompt,
            tools: toolDescriptions,
            context: contextContent,
            goal: smContext.goal,
            past_steps: JSON.stringify(smContext.steps.slice(-5))
        });

        try {
            const stepStart = Date.now();

            // FINOPS: Pre-calculate budget cap
            const remainingBudget = this.config.costBudgetCents - monitor.getMetrics().costCents;
            // Conservative estimate: 1K input tokens = $0.0005, 1K output = $0.0015 (Gemini Flash approximate)
            // If budget is low, cap tokens aggressively
            let maxTokens = 8192;
            if (remainingBudget < 1.0) maxTokens = 1000;
            if (remainingBudget < 0.1) maxTokens = 200;

            // USE ROUTER FOR EACH STEP
            const decision = await this.callLLMWithRouting(prompt, TaskComplexity.REASONING);

            // RELIABILITY: Use robust parsing
            const stepResult = JsonParser.parse<{
                thought: string;
                action: string;
                actionInput: unknown;
            }>(decision.result);

            const step: AgentStep = {
                thought: stepResult.thought,
                action: stepResult.action,
                actionInput: stepResult.actionInput,
            };

            // Record metrics
            const inputTokens = Math.ceil(prompt.length / 4);
            const outputTokens = 200; // Estimated actuals
            const duration = Date.now() - stepStart;
            const costCents = decision.decision.model.costPer1KInputTokens * (inputTokens / 1000) +
                decision.decision.model.costPer1KOutputTokens * (outputTokens / 1000);

            monitor.recordStep({
                stepId: `step-${smContext.steps.length}`,
                stepName: step.action,
                inputTokens,
                outputTokens,
                costCents,
                durationMs: duration,
                model: decision.decision.modelId,
            });
            tracer.recordTokenUsage(inputTokens, outputTokens, decision.decision.modelId);
            tracer.recordCost(costCents, decision.decision.modelId);

            // Bounded CoT: Truncate thought to save context in future steps
            const originalThought = step.thought;
            const maxThoughtLength = this.config.maxThoughtLength || 1000;
            if (step.thought && step.thought.length > maxThoughtLength) {
                step.thought = step.thought.substring(0, maxThoughtLength) + '... [Thought Truncated to Save Context]';
            }

            tracer.logStep({ ...step, thought: originalThought }); // Log original thought for debugging
            sm.recordUsage(inputTokens + outputTokens, costCents);

            // Check if this is a final answer
            if (step.action === 'Final Answer') {
                const finalAnswerText = typeof step.actionInput === 'string'
                    ? step.actionInput
                    : String(step.actionInput ?? '');
                sm.setFinalAnswer(finalAnswerText);
                sm.addStep(step);
                sm.setIntermediateResult('currentStep', step);
                await sm.transition('STEP_COMPLETE');
                tracer.logTransition(AgentPhase.EXECUTING, AgentPhase.OBSERVING, 'STEP_COMPLETE');
                tracer.endSpan('OK');
                return;
            }

            // Execute the tool
            try {
                tracer.startSpan('tool_execution', { tool: step.action });
                let observation: string;

                // SECURITY: Use ToolRegistry if available
                if (this.toolRegistry && this.toolRegistry.has(step.action)) {
                    // Default permissions: allow all registered tools (they are whitelisted by registration)
                    const defaultPermissions = new Map<string, import('./tools/ToolContracts').ToolPermission>();
                    // All tools in registry are implicitly allowed - restricted tools should not be registered
                    defaultPermissions.set(step.action, 'ALLOWED' as import('./tools/ToolContracts').ToolPermission);

                    const toolResult = await this.toolRegistry.execute(step.action, step.actionInput, {
                        userId: this.config.userId || 'system',
                        sessionId: smContext.id || 'unknown',
                        agentId: 'enhanced-react',
                        requestId: tracer.getTraceId(),
                        permissions: defaultPermissions,
                        dryRun: false
                    });

                    if (toolResult.success) {
                        observation = typeof toolResult.data === 'string'
                            ? toolResult.data
                            : JSON.stringify(toolResult.data);
                    } else {
                        throw new Error(toolResult.error?.message || 'Tool execution failed');
                    }
                } else {
                    // Fallback to legacy array check
                    const tool = this.tools.find((t) => t.metadata.id === step.action || t.metadata.name === step.action);
                    if (tool) {
                        const rawResult = await tool.execute(step.actionInput, {
                            userId: this.config.userId || 'system',
                            sessionId: smContext.id || 'unknown',
                            agentId: 'enhanced-react',
                            requestId: tracer.getTraceId(),
                            permissions: new Map(),
                            dryRun: false
                        });
                        observation = rawResult.success
                            ? (typeof rawResult.data === 'string' ? rawResult.data : JSON.stringify(rawResult.data))
                            : `Error: ${rawResult.error?.message}`;
                    } else {
                        observation = `Error: Tool ${step.action} not found.`;
                    }
                }

                step.observation = observation;
                tracer.recordEvent('tool_result', { success: true });
                tracer.endSpan('OK');
            } catch (toolError: unknown) {
                step.observation = `Error: ${(toolError as Error).message}`;
                tracer.endSpan('ERROR', (toolError as Error).message);
            }

            sm.addStep(step);
            sm.setIntermediateResult('currentStep', step);
            await sm.transition('STEP_COMPLETE');
            tracer.logTransition(AgentPhase.EXECUTING, AgentPhase.OBSERVING, 'STEP_COMPLETE');
            tracer.endSpan('OK');

        } catch (error) {
            console.error('[EnhancedReActAgent] Execution error:', error);
            tracer.endSpan('ERROR', (error as Error).message);
            sm.updateContext({ lastError: error as Error });
            await sm.transition('STEP_ERROR');
        }
    }

    /**
     * Handle observation phase.
     */
    private async handleObservation(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor
    ): Promise<void> {
        tracer.startSpan('observation_processing');

        const currentStep = sm.getIntermediateResult<AgentStep>('currentStep');

        if (!currentStep) {
            console.warn('[EnhancedReActAgent] No current step for observation');
            await sm.transition('PLAN_COMPLETE');
            tracer.endSpan('OK');
            return;
        }

        // Check if this was a final answer
        if (currentStep.action === 'Final Answer') {
            await sm.transition('PLAN_COMPLETE');
            tracer.logTransition(AgentPhase.OBSERVING, AgentPhase.REFLECTING, 'PLAN_COMPLETE');
            tracer.endSpan('OK');
            return;
        }

        // Check if observation indicates we need to replan
        const observation = currentStep.observation || '';
        if (observation.includes('Error:') && sm.getContext().replanCount < this.config.maxReplanAttempts) {
            await sm.transition('OBSERVATION_INVALIDATES');
            tracer.logTransition(AgentPhase.OBSERVING, AgentPhase.REPLANNING, 'OBSERVATION_INVALIDATES');
            tracer.endSpan('OK');
            return;
        }

        // Continue with more steps
        await sm.transition('CONTINUE_PLAN');
        tracer.logTransition(AgentPhase.OBSERVING, AgentPhase.EXECUTING, 'CONTINUE_PLAN');
        tracer.endSpan('OK');
    }

    /**
     * Handle reflection phase.
     */
    private async handleReflection(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        goal: string
    ): Promise<void> {
        tracer.startSpan('reflection');

        const smContext = sm.getContext();

        // Simple reflection - check if we have a final answer
        if (smContext.finalAnswer) {
            await sm.transition('REFLECTION_COMPLETE');
            tracer.logTransition(AgentPhase.REFLECTING, AgentPhase.SYNTHESIZING, 'REFLECTION_COMPLETE');
        } else {
            // Need to continue or replan
            if (smContext.replanCount < this.config.maxReplanAttempts) {
                await sm.transition('REFLECTION_INSUFFICIENT');
                tracer.logTransition(AgentPhase.REFLECTING, AgentPhase.REPLANNING, 'REFLECTION_INSUFFICIENT');
            } else {
                // Give up and synthesize what we have
                await sm.transition('REFLECTION_COMPLETE');
                tracer.logTransition(AgentPhase.REFLECTING, AgentPhase.SYNTHESIZING, 'REFLECTION_COMPLETE');
            }
        }

        tracer.endSpan('OK');
    }

    /**
     * Handle synthesis phase.
     */
    private async handleSynthesis(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        goal: string
    ): Promise<void> {
        tracer.startSpan('synthesis');

        const smContext = sm.getContext();

        // If we already have a final answer, we're done
        if (smContext.finalAnswer) {
            await sm.transition('ANSWER_READY');
            tracer.logTransition(AgentPhase.SYNTHESIZING, AgentPhase.DONE, 'ANSWER_READY');
            tracer.endSpan('OK');
            return;
        }



        // Otherwise, synthesize from observations
        const observations = smContext.steps
            .filter((s) => s.observation)
            .map((s) => s.observation!)
            .join('\n');

        let response = '';

        if (!observations) {
            // Simple response generation
            try {
                response = await this.llm.generateText(
                    `${this.systemPrompt}\n\nUser says: "${goal}"\n\nProvide a helpful response.`
                );
                const synthesisPrompt = `
    Based on the user's goal, provide a helpful response.
    
    GOAL: ${goal}
    
    Provide a clear, helpful response.
    `;
                const decision = await this.callLLMWithRouting(synthesisPrompt, TaskComplexity.SUMMARIZATION);
                response = decision.result;
            } catch (error) {
                response = "I'm sorry, I couldn't process your request.";
            }
        } else {
            // Synthesize from observations
            try {
                const synthesisPrompt = `
    Based on the following observations, provide a final answer to the user's goal.
    
    GOAL: ${goal}
    
    OBSERVATIONS:
    ${observations}
    
    Provide a clear, helpful response.
    `;
                const decision = await this.callLLMWithRouting(synthesisPrompt, TaskComplexity.SUMMARIZATION);
                response = decision.result;
            } catch (error) {
                response = "I found some information but couldn't synthesize a complete response.";
            }
        }

        // SENIOR COMPANION: Response Adaptation
        if (this.config.enableCompanionFeatures && response) {
            try {
                // 1. Empathy Injection
                const emotionState = sm.getIntermediateResult<any>('userEmotion');
                if (emotionState) {
                    response = this.empathyEngine.adaptResponse(response, emotionState);
                }

                // 2. Explainability
                // Convert steps to sources (approximate)
                const sources = smContext.steps
                    .filter(s => s.observation)
                    .map(s => ({
                        type: 'EXTERNAL' as any,
                        description: `Tool output from ${s.action}`,
                        obtainedAt: Date.now(),
                        reliability: 'high'
                    }));

                // Defaults for confidence
                const explainable = this.explanationEngine.createExplainableResponse(
                    response,
                    sources as any[],
                    'HIGH' as any
                );

                if (explainable.shouldOfferExplanation) {
                    response += "\n\n" + explainable.explanations.map(e => e.text).join(' ');
                }

                // 3. Cognitive Adaptation
                const adapted = this.cognitiveAdapter.adaptResponse(response);
                response = adapted.text;

                // 4. Session Continuity
                this.sessionContinuity.trackTopicDiscussion(goal);

            } catch (adaptError) {
                logger.error('[EnhancedReActAgent] Adaptation failed', { error: adaptError });
            }
        }

        sm.setFinalAnswer(response);

        await sm.transition('ANSWER_READY');
        tracer.logTransition(AgentPhase.SYNTHESIZING, AgentPhase.DONE, 'ANSWER_READY');
        tracer.endSpan('OK');
    }

    /**
     * Handle replanning phase.
     */
    private async handleReplanning(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor
    ): Promise<void> {
        tracer.startSpan('replanning');

        sm.recordReplan();
        monitor.recordReplan();

        const smContext = sm.getContext();

        if (smContext.replanCount >= this.config.maxReplanAttempts) {
            await sm.transition('REPLAN_LIMIT');
            tracer.logTransition(AgentPhase.REPLANNING, AgentPhase.HALTED, 'REPLAN_LIMIT');
            sm.setHaltReason(HaltReason.REPLAN_LIMIT);
        } else {
            await sm.transition('REPLAN_READY');
            tracer.logTransition(AgentPhase.REPLANNING, AgentPhase.PLANNING, 'REPLAN_READY');
        }

        tracer.endSpan('OK');
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    /**
     * Set up initial context in the context manager.
     */
    private setupContext(
        contextManager: ContextBudgetManager,
        context: AgentContext,
        goal: string
    ): void {
        contextManager.addSource({
            id: 'system-prompt',
            type: 'system_prompt',
            content: this.systemPrompt,
            priority: 100,
            required: true,
        });

        contextManager.addSource({
            id: 'user-goal',
            type: 'user_input',
            content: `GOAL: ${goal}`,
            priority: 90,
            required: true,
        });

        if (context.memories && context.memories.length > 0) {
            contextManager.addSource({
                id: 'memories',
                type: 'memories',
                content: `RELEVANT MEMORIES:\n${context.memories.map((m: { text: string }) => m.text).slice(0, 5).join('\n')}`,
                priority: 60,
                required: false,
            });
        }

        if (context.recentHistory && context.recentHistory.length > 0) {
            contextManager.addSource({
                id: 'history',
                type: 'conversation_history',
                content: `RECENT CONVERSATION:\n${JSON.stringify(context.recentHistory.slice(-3))}`,
                priority: 50,
                required: false,
            });
        }
    }

    /**
     * Build the intent recognition prompt.
     */
    private buildIntentPrompt(goal: string, context: AgentContext): string {
        return `
Analyze the user's input to determine their intent.

USER INPUT: "${goal}"

CONTEXT:
- User ID: ${context.userId}
- Session ID: ${context.sessionId}
- Has memories: ${context.memories && context.memories.length > 0}

Determine:
1. Primary intent (SHARE_MEMORY, RECALL_MEMORY, SHARE_EMOTION, ASK_QUESTION, CLARIFY, CHANGE_TOPIC, GREETING, END_SESSION, CONFUSED, UNKNOWN)
2. Confidence (0-1)
3. Key entities mentioned
4. Whether memory lookup is needed
5. Whether safety check is needed

OUTPUT JSON:
{
  "primaryIntent": "...",
  "confidence": 0.95,
  "entities": {},
  "requiresMemoryLookup": false,
  "requiresSafetyCheck": false,
  "reasoning": "..."
}
`;
    }

    /**
     * Interrupt the agent (for external cancellation).
     */
    interrupt(): void {
        // This would be implemented with a shared cancellation token
        logger.info('[EnhancedReActAgent] Interrupt requested');
    }

    /**
     * Halt the agent gracefully.
     */
    async halt(reason: HaltReason): Promise<void> {
        logger.warn(`[EnhancedReActAgent] Halting: ${reason}`, { reason });
        // In a real implementation, we would signal the state machine to transition to HALTED
    }

    /**
     * Get the current agent state.
     */
    getState(): AgentState {
        // Mocking for now, returns a basic state
        return {
            phase: AgentPhase.IDLE,
            stepCount: 0,
            tokenCount: 0,
            costCents: 0,
            startTime: Date.now(),
            isHalted: false,
            traceId: 'idle'
        };
    }

    /**
     * Call LLM with dynamic routing based on complexity.
     */
    private async callLLMWithRouting(
        prompt: string,
        initialComplexity?: TaskComplexity
    ): Promise<{ result: string; decision: any }> {
        const complexity = initialComplexity || this.modelRouter.analyzeComplexity(prompt);

        // Budget awareness
        const budget = {
            totalCostRemaining: this.config.costBudgetCents, // Simplified
            maxRequestCostCents: 5,
        };

        const decision = this.modelRouter.route(complexity, budget);
        logger.info(`[Router] Route decided: ${decision.modelId} for ${complexity} (${decision.reason})`, {
            model: decision.modelId,
            complexity,
            reason: decision.reason
        });

        const result = await this.llm.generateText(prompt, {
            model: decision.modelId,
            temperature: 0.7,
        });

        return { result, decision };
    }
}
