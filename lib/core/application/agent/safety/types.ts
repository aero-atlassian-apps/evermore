/**
 * Shared types for the Wellbeing Guard system.
 */

/**
 * Risk severity levels.
 */
export enum RiskSeverity {
    NONE = 'NONE',
    LOW = 'LOW',
    MODERATE = 'MODERATE',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

/**
 * Types of wellbeing concerns.
 */
export enum WellbeingConcern {
    LONELINESS = 'LONELINESS',
    DEPRESSION = 'DEPRESSION',
    SELF_HARM = 'SELF_HARM',
    SUICIDAL_IDEATION = 'SUICIDAL_IDEATION',
    COGNITIVE_DECLINE = 'COGNITIVE_DECLINE',
    DISORIENTATION = 'DISORIENTATION',
    MEDICAL_EMERGENCY = 'MEDICAL_EMERGENCY',
    SUBSTANCE_ABUSE = 'SUBSTANCE_ABUSE',
    ABUSE = 'ABUSE',
    FINANCIAL_EXPLOITATION = 'FINANCIAL_EXPLOITATION',
    FALL_RISK = 'FALL_RISK',
    DISTRESS = 'DISTRESS',
}

/**
 * Scam types to detect.
 */
export enum ScamType {
    MONEY_REQUEST = 'MONEY_REQUEST',
    GOVERNMENT_IMPERSONATION = 'GOVERNMENT_IMPERSONATION',
    TECH_SUPPORT = 'TECH_SUPPORT',
    ROMANCE = 'ROMANCE',
    LOTTERY = 'LOTTERY',
    GRANDPARENT = 'GRANDPARENT',
    MEDICARE = 'MEDICARE',
    INVESTMENT = 'INVESTMENT',
    CHARITY = 'CHARITY',
    PHISHING = 'PHISHING',
}

/**
 * A detected concern.
 */
export interface DetectedConcern {
    type: WellbeingConcern;
    severity: RiskSeverity;
    evidence: string[];
    confidence: number;
    isRecurring: boolean;
}

/**
 * Scam detection result.
 */
export interface ScamAssessment {
    isScamDetected: boolean;
    scamType?: ScamType;
    riskLevel: RiskSeverity;
    redFlags: string[];
    suggestedResponse: string;
    confidence: number;
}

/**
 * Response type for wellbeing issues.
 */
export enum ResponseType {
    SUPPORTIVE = 'SUPPORTIVE',
    COMFORT = 'COMFORT',
    ENCOURAGE_HELP = 'ENCOURAGE_HELP',
    SUGGEST_CONTACT = 'SUGGEST_CONTACT',
    ESCALATE = 'ESCALATE',
    EMERGENCY = 'EMERGENCY',
}

/**
 * Recommended action.
 */
export interface RecommendedAction {
    type: ActionType;
    priority: number;
    description: string;
    target?: string;
    requiresConsent: boolean;
}

/**
 * Types of actions.
 */
export enum ActionType {
    LOG = 'LOG',
    NOTIFY_CAREGIVER = 'NOTIFY_CAREGIVER',
    NOTIFY_FAMILY = 'NOTIFY_FAMILY',
    SCHEDULE_FOLLOWUP = 'SCHEDULE_FOLLOWUP',
    PROVIDE_RESOURCES = 'PROVIDE_RESOURCES',
    RECOMMEND_PROFESSIONAL = 'RECOMMEND_PROFESSIONAL',
    CALL_EMERGENCY = 'CALL_EMERGENCY',
    WARN_SCAM = 'WARN_SCAM',
}

/**
 * Escalation contact.
 */
export interface EscalationContact {
    name: string;
    relationship: string;
    phone?: string;
    email?: string;
    priority: number;
    escalationLevel: RiskSeverity;
}

/**
 * Wellbeing assessment result.
 */
export interface WellbeingAssessment {
    overallRisk: RiskSeverity;
    concerns: DetectedConcern[];
    requiresImmediateAction: boolean;
    responseType: ResponseType;
    suggestedResponse: string;
    recommendedActions: RecommendedAction[];
    confidence: number;
    timestamp: number;
    riskJustification: string;
}

/**
 * Configuration for the wellbeing guard.
 */
export interface WellbeingGuardConfig {
    minConfidence: number;
    enablePatternTracking: boolean;
    recurrenceThreshold: number;
    escalationContacts: EscalationContact[];
    requireMedicalDisclaimer: boolean;
}
