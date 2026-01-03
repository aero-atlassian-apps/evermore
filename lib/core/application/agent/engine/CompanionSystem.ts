import { EmpathyEngine } from '../persona/EmpathyEngine';
import { WellbeingGuard } from '../safety/WellbeingGuard';
import { RiskSeverity, WellbeingAssessment } from '../safety/types';
import { ProactiveEngine } from '../proactive/ProactiveEngine';
import { SessionContinuityManager } from '../continuity/SessionContinuity';
import { CognitiveAdapter } from '../cognitive/CognitiveAdapter';
import { ExplanationEngine } from '../transparency/ExplanationEngine';
import { AgentStateMachine } from '../state/AgentStateMachine';
import { AgentPhase } from '../primitives/AgentPrimitives';
import { EnhancedAgentTracer } from '../EnhancedAgentTracer';
import { logger } from '../../../../infrastructure/logging/LoggerService';

/**
 * Encapsulates the senior companion features of the agent.
 */
export class CompanionSystem {
    private empathyEngine: EmpathyEngine;
    private wellbeingGuard: WellbeingGuard;
    private proactiveEngine: ProactiveEngine;
    private sessionContinuity: SessionContinuityManager;
    private cognitiveAdapter: CognitiveAdapter;
    private explanationEngine: ExplanationEngine;

    constructor(userId: string) {
        this.empathyEngine = new EmpathyEngine();
        this.wellbeingGuard = new WellbeingGuard();
        this.proactiveEngine = new ProactiveEngine();
        this.sessionContinuity = new SessionContinuityManager(userId);
        this.cognitiveAdapter = new CognitiveAdapter();
        this.explanationEngine = new ExplanationEngine();
    }

    /**
     * Start a session in the companion system.
     */
    startSession(sessionId: string): void {
        this.sessionContinuity.startSession(sessionId);
    }

    /**
     * Perform initial safety and empathy checks on user input.
     * Returns true if a safety intervention is triggered.
     */
    async checkSafety(goal: string, sm: AgentStateMachine, tracer: EnhancedAgentTracer): Promise<boolean> {
        // 1. Empathy Analysis
        const emotionState = this.empathyEngine.detectEmotion(goal);
        sm.setIntermediateResult('userEmotion', emotionState);

        // 2. Safety Check
        const assessment = this.wellbeingGuard.assessWellbeing(goal, emotionState);
        if (assessment.overallRisk === RiskSeverity.HIGH || assessment.overallRisk === RiskSeverity.CRITICAL) {
            sm.setFinalAnswer(assessment.suggestedResponse);
            await sm.transition('SIMPLE_INTENT');
            tracer.logTransition(AgentPhase.RECOGNIZING_INTENT, AgentPhase.SYNTHESIZING, 'SAFETY_INTERVENTION');
            return true;
        }

        return false;
    }

    /**
     * Adapt the final response based on empathy, cognitive needs, and session history.
     */
    async adaptResponse(response: string, goal: string, sm: AgentStateMachine): Promise<string> {
        let adaptedResponse = response;

        try {
            // 1. Empathy Injection
            const emotionState = sm.getIntermediateResult<any>('userEmotion');
            if (emotionState) {
                adaptedResponse = this.empathyEngine.adaptResponse(adaptedResponse, emotionState);
            }

            // 2. Explainability
            const smContext = sm.getContext();
            const sources = smContext.steps
                .filter(s => s.observation)
                .map(s => ({
                    type: 'EXTERNAL' as any,
                    description: `Tool output from ${s.action}`,
                    obtainedAt: Date.now(),
                    reliability: 'high'
                }));

            const explainable = this.explanationEngine.createExplainableResponse(
                adaptedResponse,
                sources as any[],
                'HIGH' as any
            );

            if (explainable.shouldOfferExplanation) {
                adaptedResponse += "\n\n" + explainable.explanations.map(e => e.text).join(' ');
            }

            // 3. Cognitive Adaptation
            const cognitiveAdapted = this.cognitiveAdapter.adaptResponse(adaptedResponse);
            adaptedResponse = cognitiveAdapted.text;

            // 4. Session Continuity
            this.sessionContinuity.trackTopicDiscussion(goal);

        } catch (error) {
            logger.error('[CompanionSystem] Adaptation failed', { error });
        }

        return adaptedResponse;
    }

    /**
     * Track topic discussion.
     */
    trackTopic(goal: string): void {
        this.sessionContinuity.trackTopicDiscussion(goal);
    }
}
