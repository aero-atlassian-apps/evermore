/**
 * Wellbeing Guard - Safety guardrails for vulnerable users.
 * 
 * Critical safety system for senior users:
 * - Crisis detection (loneliness, depression, self-harm)
 * - Escalation protocols
 * - Medical misinformation prevention
 * - Scam protection
 * - Emergency response
 * 
 * @module WellbeingGuard
 */

import { EmotionCategory, EmotionalState, EmotionIntensity } from '../persona/EmpathyEngine';
import { ConcernDetector } from './engines/ConcernDetector';
import { ScamDetector } from './engines/ScamDetector';
import { SafetyResponseGenerator } from './engines/SafetyResponseGenerator';

import {
    RiskSeverity,
    WellbeingConcern,
    ScamType,
    WellbeingAssessment,
    DetectedConcern,
    ScamAssessment,
    ResponseType,
    RecommendedAction,
    ActionType,
    EscalationContact,
    WellbeingGuardConfig
} from './types';

const DEFAULT_CONFIG: WellbeingGuardConfig = {
    minConfidence: 0.4,
    enablePatternTracking: true,
    recurrenceThreshold: 3,
    escalationContacts: [],
    requireMedicalDisclaimer: true,
};

export class WellbeingGuard {
    private config: WellbeingGuardConfig;
    private concernHistory: Map<WellbeingConcern, number[]> = new Map();
    private assessmentLog: WellbeingAssessment[] = [];

    // Specialized Engines
    private concernDetector: ConcernDetector;
    private scamDetector: ScamDetector;
    private responseGenerator: SafetyResponseGenerator;

    constructor(config?: Partial<WellbeingGuardConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.concernDetector = new ConcernDetector(
            this.config.minConfidence,
            this.config.recurrenceThreshold,
            this.concernHistory
        );
        this.scamDetector = new ScamDetector();
        this.responseGenerator = new SafetyResponseGenerator();
    }

    assessWellbeing(text: string, emotionalState?: EmotionalState): WellbeingAssessment {
        const concerns = this.concernDetector.detect(text, emotionalState);

        for (const c of concerns) {
            const history = this.concernHistory.get(c.type) || [];
            history.push(Date.now());
            this.concernHistory.set(c.type, history.slice(-10));
        }

        const overallRisk = this.calculateOverallRisk(concerns);
        const responseType = this.determineResponseType(overallRisk, concerns);
        const suggestedResponse = this.responseGenerator.generateResponse(concerns, responseType);
        const recommendedActions = this.responseGenerator.buildActions(concerns, overallRisk);

        const confidence = concerns.length > 0
            ? concerns.reduce((sum, c) => sum + c.confidence, 0) / concerns.length
            : 0;

        const assessment: WellbeingAssessment = {
            overallRisk,
            concerns,
            requiresImmediateAction: overallRisk === RiskSeverity.CRITICAL,
            responseType,
            suggestedResponse,
            recommendedActions,
            confidence,
            timestamp: Date.now(),
            riskJustification: concerns.length > 0
                ? `Detected: ${concerns.map(c => c.type).join(', ')}`
                : "Safe",
        };

        this.assessmentLog.push(assessment);
        if (this.assessmentLog.length > 100) {
            this.assessmentLog = this.assessmentLog.slice(-50);
        }

        return assessment;
    }

    detectScam(text: string): ScamAssessment {
        return this.scamDetector.detect(text);
    }

    private calculateOverallRisk(concerns: DetectedConcern[]): RiskSeverity {
        if (concerns.length === 0) return RiskSeverity.NONE;
        const criticalTypes = [WellbeingConcern.SUICIDAL_IDEATION, WellbeingConcern.MEDICAL_EMERGENCY, WellbeingConcern.SELF_HARM, WellbeingConcern.ABUSE];
        if (concerns.some(c => criticalTypes.includes(c.type))) return RiskSeverity.CRITICAL;
        const severities = concerns.map(c => c.severity);
        if (severities.includes(RiskSeverity.CRITICAL)) return RiskSeverity.CRITICAL;
        if (severities.includes(RiskSeverity.HIGH)) return RiskSeverity.HIGH;
        if (severities.includes(RiskSeverity.MODERATE)) return RiskSeverity.MODERATE;
        if (severities.includes(RiskSeverity.LOW)) return RiskSeverity.LOW;
        return RiskSeverity.NONE;
    }

    private determineResponseType(risk: RiskSeverity, concerns: DetectedConcern[]): ResponseType {
        switch (risk) {
            case RiskSeverity.CRITICAL:
                const isEmergency = concerns.some(c => c.type === WellbeingConcern.SUICIDAL_IDEATION || c.type === WellbeingConcern.MEDICAL_EMERGENCY);
                return isEmergency ? ResponseType.EMERGENCY : ResponseType.ESCALATE;
            case RiskSeverity.HIGH: return ResponseType.SUGGEST_CONTACT;
            case RiskSeverity.MODERATE: return ResponseType.ENCOURAGE_HELP;
            case RiskSeverity.LOW: return ResponseType.COMFORT;
            default: return ResponseType.SUPPORTIVE;
        }
    }

    addEscalationContact(contact: EscalationContact): void {
        this.config.escalationContacts.push(contact);
        this.config.escalationContacts.sort((a, b) => a.priority - b.priority);
    }

    getConcernHistory(): Map<WellbeingConcern, number> {
        const summary = new Map<WellbeingConcern, number>();
        for (const [concern, timestamps] of this.concernHistory) {
            summary.set(concern, timestamps.length);
        }
        return summary;
    }

    clearHistory(): void {
        this.concernHistory.clear();
        this.assessmentLog = [];
    }
}
