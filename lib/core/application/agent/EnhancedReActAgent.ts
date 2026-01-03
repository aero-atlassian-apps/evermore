/**
 * Enhanced ReAct Agent - State machine-driven ReAct implementation.
 * 
 * This is a modernized version of the ReActAgent that uses the explicit
 * state machine, monitoring, tracing, and new primitive interfaces.
 * 
 * @module EnhancedReActAgent
 */

import { LLMPort } from '../ports/LLMPort';
import { VectorStorePort } from '../ports/VectorStorePort';
import { EmbeddingPort } from '../ports/EmbeddingPort';
import { AgentStep, Tool, AgentContext } from './types';
import { AgentStateMachine, StateMachineContext } from './state/AgentStateMachine';
import { AgentLoopMonitor, StepMetrics } from './monitoring/AgentLoopMonitor';
import { EnhancedAgentTracer } from './EnhancedAgentTracer';
import { ContextBudgetManager } from './context/ContextBudgetManager';
import { ContextOptimizer } from './context/ContextOptimizer';
import { PromptRegistry, createDefaultPromptRegistry } from './prompts/PromptRegistry';
import { ToolRegistry } from './tools/ToolContracts';
import { JsonParser } from '../utils/JsonParser';
import { logger } from '../../../infrastructure/logging/LoggerService';
import { ModelRouter, ModelProfile } from './routing/ModelRouter';
import {
    AgenticRunnerConfig,
    AgenticRunner,
    AgentPhase,
    HaltReason,
    RecognizedIntent,
    IntentType,
    TaskComplexity,
    ProcessedObservation,
    ObservationType,
    ExecutionPlan,
    AgentState,
} from './primitives/AgentPrimitives';

// Learning Pipeline Integration (100M Roadmap - Phase 1)
import { SelfImprovementManager, ExecutionRecord, ExecutionOutcome } from './learning/SelfImprovement';
import { MemoryType, MemoryImportance, AgentMemoryManager } from './memory/AgentMemory';
import { PhaseHandlers } from './engine/PhaseHandlers';
import { CompanionSystem } from './engine/CompanionSystem';
import { SessionContinuityManager } from './continuity/SessionContinuity';

// Data Flywheel Integration (100M Roadmap - Phase 2)
import { SignalCollectorPort } from '../ports/SignalCollectorPort';
import { createInteractionSignal, InteractionSignal } from '../../domain/InteractionSignal';

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

    // Engine Modules (Decoupled Phase 1.1)
    private phaseHandlers: PhaseHandlers;
    private companionSystem: CompanionSystem;

    private memory: AgentMemoryManager;
    private tracer!: EnhancedAgentTracer;
    // Learning Pipeline Integration (100M Roadmap - Phase 1)
    private selfImprovementManager: SelfImprovementManager;
    // Data Flywheel Integration (100M Roadmap - Phase 2)
    private signalCollector?: SignalCollectorPort;
    private sessionContinuity: SessionContinuityManager;

    constructor(
        llm: LLMPort,
        modelRouter: ModelRouter,
        tools: Tool[],
        config: Partial<EnhancedReActAgentConfig> & { modelProfile: ModelProfile },
        vectorStore?: VectorStorePort,
        embeddingPort?: EmbeddingPort,
        promptRegistry?: PromptRegistry,
        toolRegistry?: ToolRegistry, // Injected dependency
        signalCollector?: SignalCollectorPort // Data Flywheel (100M Roadmap)
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

        // Initialize Engine Modules (Decoupled Phase 1.1)
        this.phaseHandlers = new PhaseHandlers(
            this.llm,
            this.modelRouter,
            this.promptRegistry!,
            this.tools,
            this.toolRegistry,
            this.config
        );
        this.companionSystem = new CompanionSystem(this.config.userId || 'default-user');

        // Initialize Memory and Tracing
        this.memory = new AgentMemoryManager(this.config.userId || 'system', vectorStore, embeddingPort);
        // Note: tracer is initialized in run() where goal/context are available

        // Learning Pipeline Integration (100M Roadmap - Phase 1)
        this.selfImprovementManager = new SelfImprovementManager();
        // Data Flywheel Integration (100M Roadmap - Phase 2)
        this.signalCollector = signalCollector;
        this.sessionContinuity = new SessionContinuityManager(this.config.userId || 'system');
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
                        await this.phaseHandlers.handleIntentRecognition(stateMachine, tracer, monitor, goal, context, this.companionSystem);
                        break;

                    case AgentPhase.DECOMPOSING_TASK:
                        await this.phaseHandlers.handleTaskDecomposition(stateMachine, tracer, monitor, goal);
                        break;

                    case AgentPhase.PLANNING:
                        await this.phaseHandlers.handlePlanning(stateMachine, tracer, monitor, contextManager);
                        break;

                    case AgentPhase.EXECUTING:
                        await this.phaseHandlers.handleExecution(stateMachine, tracer, monitor, contextManager, this.systemPrompt);
                        break;

                    case AgentPhase.OBSERVING:
                        await this.phaseHandlers.handleObservation(stateMachine, tracer, monitor);
                        break;

                    case AgentPhase.REFLECTING:
                        await this.phaseHandlers.handleReflection(stateMachine, tracer, monitor);
                        break;

                    case AgentPhase.SYNTHESIZING:
                        await this.phaseHandlers.handleSynthesis(stateMachine, tracer, monitor, goal, this.companionSystem);
                        break;

                    case AgentPhase.REPLANNING:
                        await this.phaseHandlers.handleReplanning(stateMachine, tracer, monitor);
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

        // Learning Pipeline Integration (100M Roadmap - Phase 1): Record Execution for Preference Learning
        const finalMetrics = monitor.getMetrics();
        const executionRecord: ExecutionRecord = {
            id: tracer.getTraceId(),
            agentId: 'enhanced-react',
            goal: goal,
            outcome: smContext.haltReason === HaltReason.SUCCESS
                ? ExecutionOutcome.SUCCESS
                : smContext.haltReason === HaltReason.ERROR
                    ? ExecutionOutcome.ERROR
                    : smContext.haltReason === HaltReason.TIMEOUT
                        ? ExecutionOutcome.TIMEOUT
                        : ExecutionOutcome.FAILURE,
            stepCount: smContext.steps.length,
            tokenUsage: finalMetrics.totalTokens,
            costCents: finalMetrics.costCents,
            durationMs: finalMetrics.elapsedMs,
            toolsUsed: smContext.steps.map(s => s.action).filter(Boolean) as string[],
            errorPatterns: smContext.lastError ? [smContext.lastError.message] : [],
            successPatterns: smContext.steps
                .filter(s => s.observation && !s.observation.startsWith('Error'))
                .map(s => s.action)
                .filter(Boolean) as string[],
            timestamp: Date.now(),
            strategy: this.config.modelProfile,
            contextFeatures: {
                userId: context.userId,
                sessionId: context.sessionId,
            },
        };
        this.selfImprovementManager.recordExecution(executionRecord);
        tracer.recordEvent('execution_recorded_for_learning', { executionId: executionRecord.id });

        // Data Flywheel Integration (100M Roadmap - Phase 2): Emit InteractionSignal
        if (this.signalCollector) {
            try {
                const signal = createInteractionSignal({
                    userId: context.userId || 'anonymous',
                    sessionId: context.sessionId || 'unknown',
                    inputText: goal,
                    detectedEmotion: 'neutral', // TODO: Wire from EmpathyEngine result
                    emotionConfidence: 0.5,
                    intentCategory: (smContext as any).recognizedIntent?.type || 'general',
                    responseId: tracer.getTraceId(),
                    responseLatencyMs: finalMetrics.elapsedMs,
                    modelUsed: this.config.modelProfile,
                    responsePreview: (smContext.finalAnswer || '').substring(0, 500),
                    agentStepCount: smContext.steps.length,
                    implicitFeedback: {
                        sessionContinued: true, // Updated later via updateImplicitFeedback
                        followUpQuestions: 0,
                        topicChange: false,
                        conversationEndedBy: 'ongoing',
                        responseDelayMs: 0,
                        nextMessageLength: 0,
                    },
                });
                await this.signalCollector.recordSignal(signal);
                tracer.recordEvent('interaction_signal_emitted', { signalId: signal.id });
            } catch (e) {
                console.warn('[EnhancedReActAgent] Failed to emit interaction signal:', e);
            }
        }

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

    // Phases are now handled by PhaseHandlers (Phase 1.1 Decoupling)

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
