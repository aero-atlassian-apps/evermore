/**
 * Agent Orchestrator - The Central Brain.
 * 
 * Coordinates the entire agentic lifecycle:
 * 1. Intent Recognition
 * 2. Planning (AoT)
 * 3. Execution (ReAct Loop)
 * 4. Reflection
 * 5. Synthesis
 * 
 * @module AgentOrchestrator
 */

import { LLMPort } from '../../ports/LLMPort';
import { AgentContext, AgentStep, Tool } from '../types';
import {
    AgenticRunner,
    AgenticRunResult,
    AgentState,
    AgentPhase,
    HaltReason,
    IntentType,
    ExecutionPlan,
    ProcessedObservation,
    ObservationType,
    PlannedStep,
    ExecutionContext,
    SubTaskType
} from '../primitives/AgentPrimitives';

import { logger } from '../../Logger';
import { ContextManager } from '../context/ContextManager';
import { AgentLoopMonitor } from '../monitoring/AgentLoopMonitor';
import { IntentRecognizer } from '../recognition/IntentRecognizer';
import { EnhancedAgentPlanner } from '../planning/EnhancedAgentPlanner';
import { StepExecutor } from '../execution/StepExecutor';
import { ObservationReflector } from '../reflection/ObservationReflector';
import { AnswerSynthesizer } from '../execution/AnswerSynthesizer'; // Check path

export class AgentOrchestrator implements AgenticRunner {
    private state: AgentState;
    private contextManager: ContextManager;
    private intentRecognizer: IntentRecognizer;
    private planner: EnhancedAgentPlanner;
    private stepExecutor: StepExecutor;
    private reflector: ObservationReflector;
    private synthesizer: AnswerSynthesizer;
    private monitor: AgentLoopMonitor;

    constructor(
        private llm: LLMPort,
        private tools: Tool[]
    ) {
        this.contextManager = new ContextManager();
        this.intentRecognizer = new IntentRecognizer(llm);
        this.planner = new EnhancedAgentPlanner(llm); // Default config
        this.stepExecutor = new StepExecutor(llm, tools);
        this.reflector = new ObservationReflector(llm);
        this.synthesizer = new AnswerSynthesizer(llm);

        // Initialize monitor with default config (should be passed in via config)
        this.monitor = new AgentLoopMonitor({
            maxSteps: 20,
            maxTimeMs: 60000,
            maxTokens: 10000,
            maxCostCents: 50,
            maxReplanAttempts: 3
        });

        this.state = {
            phase: AgentPhase.IDLE,
            stepCount: 0,
            tokenCount: 0,
            costCents: 0,
            startTime: 0,
            isHalted: false,
            traceId: `trace-${Date.now()}` // Default traceId
        };
    }

    public async run(goal: string, context: AgentContext): Promise<AgenticRunResult> {
        this.resetState();
        this.monitor.reset(); // Reset monitor
        const startTime = Date.now();
        const runId = `run-${startTime}`;

        try {
            // 1. INTENT RECOGNITION
            this.updatePhase(AgentPhase.RECOGNIZING_INTENT);
            logger.info('[AgentOrchestrator] Recognizing intent', { traceId: runId, goal });
            const intent = await this.intentRecognizer.recognize(goal, context);
            logger.info('[AgentOrchestrator] Intent recognized', { traceId: runId, intent: intent.primaryIntent, confidence: intent.confidence });

            // Short-circuit for Greetings / End Session
            if (intent.primaryIntent === IntentType.GREETING || intent.primaryIntent === IntentType.END_SESSION) {
                const reply = await this.synthesizer.synthesizeSimpleReply(goal, intent, context);
                return this.buildResult(true, reply, [], [], undefined, startTime, runId);
            }

            // 2. PLANNING (AoT)
            this.updatePhase(AgentPhase.PLANNING);
            logger.info('[AgentOrchestrator] Generating plan', { traceId: runId });
            let plan: ExecutionPlan;

            // Simple logic: if simple query, make simple plan. If share memory, make verification plan.
            if (intent.primaryIntent === IntentType.ASK_QUESTION && intent.confidence > 0.8) {
                plan = await this.planner.createSimplePlan(goal, context);
            } else {
                // Full decomposition for complex tasks
                const decomposition = {
                    subTasks: [{
                        id: 'main',
                        description: goal,
                        type: SubTaskType.GENERATION,
                        complexity: 'medium' as const,
                        optional: false
                    }],
                    dependencies: new Map<string, string[]>(),
                    estimatedComplexity: 'medium' as const
                };
                plan = await this.planner.generate(decomposition, { maxSteps: 10 });
            }
            logger.info('[AgentOrchestrator] Plan generated', { traceId: runId, stepCount: plan.steps.length });

            // 3. EXECUTION LOOP
            this.updatePhase(AgentPhase.EXECUTING);
            const stepsTaken: AgentStep[] = [];
            const observations: ProcessedObservation[] = [];

            const executionContext: ExecutionContext = {
                agentContext: context,
                previousResults: [],
                observations: [],
                tokenCount: 0,
                costCents: 0
            };

            let finalReflection: any;

            for (const step of plan.steps) {
                // Check monitor limits
                if (this.monitor.shouldHalt()) {
                    const haltReason = this.monitor.getHaltReason();
                    this.halt(haltReason || HaltReason.MAX_STEPS); // Fallback
                    break;
                }

                if (this.state.isHalted) break;
                if (this.state.stepCount >= (plan.maxRetries || 10)) {
                    this.halt(HaltReason.MAX_STEPS);
                    break;
                }

                this.state.stepCount++;
                logger.info('[AgentOrchestrator] Executing step', { traceId: runId, step: step.order, action: step.action });

                // EXECUTE
                const result = await this.stepExecutor.execute(step, executionContext);

                // Track usage in state AND monitor
                executionContext.previousResults.push(result);
                this.state.tokenCount += result.tokensUsed;
                this.state.costCents += result.costCents;

                this.monitor.recordStep({
                    stepId: step.id,
                    stepName: step.action,
                    inputTokens: 0, // Need to get actuals if avail
                    outputTokens: result.tokensUsed, // Approximation if split not avail
                    costCents: result.costCents,
                    durationMs: result.durationMs,
                    model: 'unknown'
                });

                // OBSERVE
                this.updatePhase(AgentPhase.OBSERVING);
                const observation: ProcessedObservation = {
                    stepId: step.id,
                    type: result.success ? ObservationType.INFORMATION : ObservationType.ERROR,
                    insight: `Result: ${JSON.stringify(result.output)}`, // Simplified
                    confidence: 1,
                    invalidatesPlan: false,
                    rawData: result.output
                };
                observations.push(observation);
                executionContext.observations.push(observation);

                stepsTaken.push({
                    thought: `Executing step ${step.id}`,
                    action: step.action,
                    actionInput: step.input,
                    observation: observation.insight
                });

                // REFLECT
                this.updatePhase(AgentPhase.REFLECTING);
                const reflection = await this.reflector.validate(observations, goal);

                if (reflection.goalAchieved && reflection.readyForUser) {
                    logger.info('[AgentOrchestrator] Goal achieved', { traceId: runId });
                    finalReflection = reflection;
                    break; // Done!
                }

                // Break loop if error and not recoverable (simplified)
                if (!result.success && step.onFailure === 'abort') {
                    logger.error('[AgentOrchestrator] Critical step failed', { traceId: runId, stepId: step.id });
                    break;
                }
            }

            // 4. SYNTHESIS
            this.updatePhase(AgentPhase.SYNTHESIZING);
            let finalAnswer = "";

            if (finalReflection && finalReflection.goalAchieved) {
                finalAnswer = await this.synthesizer.synthesize(finalReflection, context);
            } else {
                finalAnswer = "I tried to help, but I couldn't fully complete the task based on the steps I took.";
                if (observations.length > 0) {
                    // Fallback synthesis
                    finalAnswer += " Here is what I found: " + observations.map(o => o.insight).join('. ');
                }
            }

            this.updatePhase(AgentPhase.DONE);
            return this.buildResult(true, finalAnswer, stepsTaken, observations, finalReflection, startTime, runId);

        } catch (error: any) {
            logger.error('[AgentOrchestrator] Fatal Error', { traceId: runId, error: error.message });
            this.updatePhase(AgentPhase.ERROR);
            return this.buildResult(false, `System Error: ${error.message}`, [], [], undefined, startTime, runId);
        }
    }

    public getState(): AgentState {
        return { ...this.state };
    }

    public async halt(reason: HaltReason): Promise<void> {
        this.state.isHalted = true;
        logger.warn('[AgentOrchestrator] Halted', { traceId: this.state.traceId, reason });
    }

    private updatePhase(phase: AgentPhase) {
        this.state.phase = phase;
    }

    private resetState() {
        this.state = {
            phase: AgentPhase.IDLE,
            stepCount: 0,
            tokenCount: 0,
            costCents: 0,
            startTime: Date.now(),
            isHalted: false,
            traceId: `trace-${Date.now()}`
        };
    }

    private buildResult(
        success: boolean,
        finalAnswer: string,
        steps: AgentStep[],
        observations: ProcessedObservation[],
        reflection: any,
        startTime: number,
        traceId: string
    ): AgenticRunResult {
        return {
            success,
            finalAnswer,
            steps,
            observations,
            reflection,
            totalTokens: this.state.tokenCount,
            totalCostCents: this.state.costCents,
            durationMs: Date.now() - startTime,
            traceId
        };
    }
}
