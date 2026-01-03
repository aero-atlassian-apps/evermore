import { AgentPhase, HaltReason, RecognizedIntent, IntentType, TaskComplexity } from '../primitives/AgentPrimitives';
import { AgentStep, Tool, AgentContext } from '../types';
import { AgentStateMachine } from '../state/AgentStateMachine';
import { EnhancedAgentTracer } from '../EnhancedAgentTracer';
import { AgentLoopMonitor } from '../monitoring/AgentLoopMonitor';
import { ContextBudgetManager } from '../context/ContextBudgetManager';
import { JsonParser } from '../../utils/JsonParser';
import { logger } from '../../../../infrastructure/logging/LoggerService';
import { LLMPort } from '../../ports/LLMPort';
import { ModelRouter } from '../routing/ModelRouter';
import { PromptRegistry } from '../prompts/PromptRegistry';
import { ToolRegistry, ToolPermission } from '../tools/ToolContracts';

/**
 * Orchestrates the individual phases of the Enhanced ReAct loop.
 */
export class PhaseHandlers {
    constructor(
        private llm: LLMPort,
        private modelRouter: ModelRouter,
        private promptRegistry: PromptRegistry,
        private tools: Tool[],
        private toolRegistry?: ToolRegistry,
        private config?: any
    ) { }

    /**
     * Handle intent recognition.
     */
    async handleIntentRecognition(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        goal: string,
        context: AgentContext,
        companionSystem: any // Dependency injection for companion logic
    ): Promise<void> {
        tracer.startSpan('intent_recognition');

        // Safety & Empathy checks (via companion system)
        if (companionSystem) {
            const safetyIntervention = await companionSystem.checkSafety(goal, sm, tracer);
            if (safetyIntervention) {
                tracer.endSpan('OK');
                return;
            }
        }

        // Check for simple intent skip
        if (this.config?.skipIntentForSimple && goal.length < (this.config.simpleQueryThreshold || 50)) {
            sm.setIntermediateResult('intent', {
                primaryIntent: IntentType.GREETING,
                confidence: 0.9,
                entities: {},
                requiresMemoryLookup: false,
                requiresSafetyCheck: false,
                reasoning: 'Simple query',
            });
            await sm.transition('SIMPLE_INTENT');
            tracer.logTransition(AgentPhase.RECOGNIZING_INTENT, AgentPhase.SYNTHESIZING, 'SIMPLE_INTENT');
            tracer.endSpan('OK');
            return;
        }

        try {
            const intentPrompt = this.promptRegistry.render('intent-recognition', {
                user_input: goal,
                context: `User ID: ${context.userId}, Session: ${context.sessionId}`
            });

            const { result, decision } = await this.callLLMWithRouting(intentPrompt, TaskComplexity.CLASSIFICATION);
            const intent = JsonParser.parse<RecognizedIntent>(result);

            monitor.recordStep({
                stepId: `intent-${Date.now()}`,
                stepName: 'intent_recognition',
                inputTokens: Math.ceil(intentPrompt.length / 4),
                outputTokens: 200,
                costCents: 0, // Simplified for brevity in this extraction
                durationMs: 500,
                model: decision.modelId,
            });

            sm.setIntermediateResult('intent', intent);

            if (intent.primaryIntent === IntentType.GREETING || intent.confidence < 0.3) {
                await sm.transition('SIMPLE_INTENT');
                tracer.logTransition(AgentPhase.RECOGNIZING_INTENT, AgentPhase.SYNTHESIZING, 'SIMPLE_INTENT');
            } else {
                await sm.transition('INTENT_RECOGNIZED');
                tracer.logTransition(AgentPhase.RECOGNIZING_INTENT, AgentPhase.DECOMPOSING_TASK, 'INTENT_RECOGNIZED');
            }
            tracer.endSpan('OK');
        } catch (error: any) {
            logger.error('Intent recognition failed', { error });
            tracer.endSpan('ERROR', error.message);
            await sm.transition('INTENT_ERROR');
        }
    }

    /**
     * Handle task decomposition.
     */
    async handleTaskDecomposition(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        goal: string
    ): Promise<void> {
        tracer.startSpan('task_decomposition');
        try {
            if (goal.length > 200) {
                const prompt = `Break down this complex request: "${goal}"\nOutput JSON array of strings.`;
                const { result } = await this.callLLMWithRouting(prompt, TaskComplexity.REASONING);
                try {
                    const subgoals = JsonParser.parse<string[]>(result);
                    sm.setIntermediateResult('subgoals', subgoals);
                    tracer.recordEvent('task_decomposed', { count: subgoals.length });
                } catch (e) { }
            }
            await sm.transition('TASK_DECOMPOSED');
            tracer.logTransition(AgentPhase.DECOMPOSING_TASK, AgentPhase.PLANNING, 'TASK_DECOMPOSED');
            tracer.endSpan('OK');
        } catch (error: any) {
            await sm.transition('TASK_DECOMPOSED');
            tracer.endSpan('ERROR', error.message);
        }
    }

    /**
     * Handle planning.
     */
    async handlePlanning(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        contextManager: ContextBudgetManager
    ): Promise<void> {
        tracer.startSpan('planning');
        const smContext = sm.getContext();
        const optimizedContext = contextManager.optimize();

        const toolDescriptions = this.tools
            .map((t) => `${t.metadata.name}: ${t.metadata.description} (Schema: ${JSON.stringify(t.inputSchema)})`)
            .join('\n');

        sm.setIntermediateResult('toolDescriptions', toolDescriptions);
        sm.setIntermediateResult('contextContent', optimizedContext.content);

        await sm.transition('PLAN_READY');
        tracer.logTransition(AgentPhase.PLANNING, AgentPhase.EXECUTING, 'PLAN_READY');
        tracer.endSpan('OK');
    }

    /**
     * Handle execution of a single step.
     */
    async handleExecution(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        contextManager: ContextBudgetManager,
        systemPrompt: string
    ): Promise<void> {
        tracer.startSpan('execute_step');
        const smContext = sm.getContext();

        const budgetLimit = sm.checkBudgetLimits();
        if (budgetLimit) {
            sm.setHaltReason(budgetLimit);
            await sm.transition('STEP_LIMIT');
            tracer.endSpan('ERROR', `Budget limit: ${budgetLimit}`);
            return;
        }

        const promptManualVars: Record<string, string> = {
            system_prompt: systemPrompt,
            tools: sm.getIntermediateResult<string>('toolDescriptions') || '',
            context: sm.getIntermediateResult<string>('contextContent') || '',
            goal: smContext.goal,
            past_steps: JSON.stringify(smContext.steps.slice(-5))
        };
        const prompt = this.promptRegistry.render('task-react-execution', promptManualVars);

        try {
            const stepStart = Date.now();
            const { result, decision } = await this.callLLMWithRouting(prompt, TaskComplexity.REASONING);
            const stepResult = JsonParser.parse<any>(result);

            const step: AgentStep = {
                thought: stepResult.thought,
                action: stepResult.action,
                actionInput: stepResult.actionInput,
            };

            const inputTokens = Math.ceil(prompt.length / 4);
            const outputTokens = 200;
            const costCents = decision.model.costPer1KInputTokens * (inputTokens / 1000) +
                decision.model.costPer1KOutputTokens * (outputTokens / 1000);

            monitor.recordStep({
                stepId: `step-${smContext.steps.length}`,
                stepName: step.action,
                inputTokens,
                outputTokens,
                costCents,
                durationMs: Date.now() - stepStart,
                model: decision.modelId,
            });

            tracer.recordTokenUsage(inputTokens, outputTokens, decision.modelId);
            tracer.recordCost(costCents, decision.modelId);
            sm.recordUsage(inputTokens + outputTokens, costCents);

            if (step.action === 'Final Answer') {
                sm.setFinalAnswer(String(step.actionInput || ''));
                sm.addStep(step);
                sm.setIntermediateResult('currentStep', step);
                await sm.transition('STEP_COMPLETE');
                tracer.logTransition(AgentPhase.EXECUTING, AgentPhase.OBSERVING, 'STEP_COMPLETE');
                tracer.endSpan('OK');
                return;
            }

            // Tool Execution
            try {
                tracer.startSpan('tool_execution', { tool: step.action });
                let observation: string;

                if (this.toolRegistry?.has(step.action)) {
                    const result = await this.toolRegistry.execute(step.action, step.actionInput, {
                        userId: this.config?.userId || 'system',
                        sessionId: smContext.id || 'default-session',
                        agentId: 'enhanced-react',
                        requestId: tracer.getTraceId(),
                        permissions: new Map([[step.action, ToolPermission.ALLOWED]]),
                        dryRun: false
                    });
                    observation = result.success ? JSON.stringify(result.data) : (result.error?.message || 'Failed');
                } else {
                    const tool = this.tools.find(t => t.metadata.id === step.action);
                    if (tool) {
                        const res = await tool.execute(step.actionInput, {
                            userId: 'system', sessionId: 'unknown', agentId: 'react', requestId: 'req',
                            permissions: new Map(), dryRun: false
                        });
                        observation = res.success ? JSON.stringify(res.data) : (res.error?.message || 'Error');
                    } else {
                        observation = `Error: Tool ${step.action} not found.`;
                    }
                }
                step.observation = observation;
                tracer.recordEvent('tool_result', { success: true });
                tracer.endSpan('OK');
            } catch (e: any) {
                step.observation = `Error: ${e.message}`;
                tracer.endSpan('ERROR', e.message);
            }

            sm.addStep(step);
            sm.setIntermediateResult('currentStep', step);
            await sm.transition('STEP_COMPLETE');
            tracer.logTransition(AgentPhase.EXECUTING, AgentPhase.OBSERVING, 'STEP_COMPLETE');
            tracer.endSpan('OK');

        } catch (error: any) {
            logger.error('Execution error', { error });
            sm.updateContext({ lastError: error });
            await sm.transition('STEP_ERROR');
            tracer.endSpan('ERROR', error.message);
        }
    }

    /**
     * Handle observation.
     */
    async handleObservation(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor
    ): Promise<void> {
        tracer.startSpan('observation_processing');
        const currentStep = sm.getIntermediateResult<AgentStep>('currentStep');
        if (!currentStep) {
            await sm.transition('PLAN_COMPLETE');
            tracer.endSpan('OK');
            return;
        }

        if (currentStep.action === 'Final Answer') {
            await sm.transition('PLAN_COMPLETE');
            tracer.logTransition(AgentPhase.OBSERVING, AgentPhase.REFLECTING, 'PLAN_COMPLETE');
        } else if ((currentStep.observation || '').includes('Error:') && sm.getContext().replanCount < (this.config?.maxReplanAttempts || 2)) {
            await sm.transition('OBSERVATION_INVALIDATES');
            tracer.logTransition(AgentPhase.OBSERVING, AgentPhase.REPLANNING, 'OBSERVATION_INVALIDATES');
        } else {
            await sm.transition('CONTINUE_PLAN');
            tracer.logTransition(AgentPhase.OBSERVING, AgentPhase.EXECUTING, 'CONTINUE_PLAN');
        }
        tracer.endSpan('OK');
    }

    /**
     * Handle reflection.
     */
    async handleReflection(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor
    ): Promise<void> {
        tracer.startSpan('reflection');
        if (sm.getContext().finalAnswer || sm.getContext().replanCount >= (this.config?.maxReplanAttempts || 2)) {
            await sm.transition('REFLECTION_COMPLETE');
            tracer.logTransition(AgentPhase.REFLECTING, AgentPhase.SYNTHESIZING, 'REFLECTION_COMPLETE');
        } else {
            await sm.transition('REFLECTION_INSUFFICIENT');
            tracer.logTransition(AgentPhase.REFLECTING, AgentPhase.REPLANNING, 'REFLECTION_INSUFFICIENT');
        }
        tracer.endSpan('OK');
    }

    /**
     * Handle synthesis.
     */
    async handleSynthesis(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor,
        goal: string,
        companionSystem: any
    ): Promise<void> {
        tracer.startSpan('synthesis');
        const smContext = sm.getContext();
        let response = smContext.finalAnswer;

        if (!response) {
            const observations = smContext.steps.map(s => s.observation).filter(Boolean).join('\n');
            const prompt = `Goal: ${goal}\nObservations: ${observations}\nProvide final answer.`;
            const { result } = await this.callLLMWithRouting(prompt, TaskComplexity.SUMMARIZATION);
            response = result;
        }

        if (companionSystem) {
            response = await companionSystem.adaptResponse(response, goal, sm);
        }

        sm.setFinalAnswer(response || '');
        await sm.transition('ANSWER_READY');
        tracer.logTransition(AgentPhase.SYNTHESIZING, AgentPhase.DONE, 'ANSWER_READY');
        tracer.endSpan('OK');
    }

    /**
     * Handle replanning.
     */
    async handleReplanning(
        sm: AgentStateMachine,
        tracer: EnhancedAgentTracer,
        monitor: AgentLoopMonitor
    ): Promise<void> {
        tracer.startSpan('replanning');
        sm.recordReplan();
        monitor.recordReplan();

        if (sm.getContext().replanCount >= (this.config?.maxReplanAttempts || 2)) {
            await sm.transition('REPLAN_LIMIT');
            sm.setHaltReason(HaltReason.REPLAN_LIMIT);
        } else {
            await sm.transition('REPLAN_READY');
            tracer.logTransition(AgentPhase.REPLANNING, AgentPhase.PLANNING, 'REPLAN_READY');
        }
        tracer.endSpan('OK');
    }

    /**
     * Call LLM with routing.
     */
    private async callLLMWithRouting(prompt: string, complexity: TaskComplexity) {
        const decision = this.modelRouter.route(complexity, { totalCostRemaining: 100, maxRequestCostCents: 5 });
        const result = await this.llm.generateText(prompt, { model: decision.modelId });
        return { result, decision };
    }
}
