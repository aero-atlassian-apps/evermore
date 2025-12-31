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

// ============================================================================
// Types
// ============================================================================

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
    /** Feelings of isolation */
    LONELINESS = 'LONELINESS',
    /** Signs of depression */
    DEPRESSION = 'DEPRESSION',
    /** Self-harm indicators */
    SELF_HARM = 'SELF_HARM',
    /** Suicidal ideation */
    SUICIDAL_IDEATION = 'SUICIDAL_IDEATION',
    /** Cognitive decline signs */
    COGNITIVE_DECLINE = 'COGNITIVE_DECLINE',
    /** Disorientation */
    DISORIENTATION = 'DISORIENTATION',
    /** Medical emergency */
    MEDICAL_EMERGENCY = 'MEDICAL_EMERGENCY',
    /** Substance abuse */
    SUBSTANCE_ABUSE = 'SUBSTANCE_ABUSE',
    /** Elder abuse indicators */
    ABUSE = 'ABUSE',
    /** Financial exploitation */
    FINANCIAL_EXPLOITATION = 'FINANCIAL_EXPLOITATION',
    /** Falls/Accidents */
    FALL_RISK = 'FALL_RISK',
    /** General distress */
    DISTRESS = 'DISTRESS',
}

/**
 * Scam types to detect.
 */
export enum ScamType {
    /** Unsolicited money requests */
    MONEY_REQUEST = 'MONEY_REQUEST',
    /** IRS/Government impersonation */
    GOVERNMENT_IMPERSONATION = 'GOVERNMENT_IMPERSONATION',
    /** Tech support scam */
    TECH_SUPPORT = 'TECH_SUPPORT',
    /** Romance scam */
    ROMANCE = 'ROMANCE',
    /** Lottery/Prize scam */
    LOTTERY = 'LOTTERY',
    /** Grandparent scam */
    GRANDPARENT = 'GRANDPARENT',
    /** Medicare scam */
    MEDICARE = 'MEDICARE',
    /** Investment scam */
    INVESTMENT = 'INVESTMENT',
    /** Charity scam */
    CHARITY = 'CHARITY',
    /** Phishing */
    PHISHING = 'PHISHING',
}

/**
 * Wellbeing assessment result.
 */
export interface WellbeingAssessment {
    /** Overall risk level */
    overallRisk: RiskSeverity;
    /** Specific concerns detected */
    concerns: DetectedConcern[];
    /** Whether immediate action is needed */
    requiresImmediateAction: boolean;
    /** Recommended response type */
    responseType: ResponseType;
    /** Suggested response text */
    suggestedResponse: string;
    /** Actions to take */
    recommendedActions: RecommendedAction[];
    /** Confidence in assessment */
    confidence: number;
    /** Assessment timestamp */
    timestamp: number;
    /** Justification for the risk assessment */
    riskJustification: string;
}

/**
 * A detected concern.
 */
export interface DetectedConcern {
    /** Type of concern */
    type: WellbeingConcern;
    /** Severity level */
    severity: RiskSeverity;
    /** Evidence that triggered detection */
    evidence: string[];
    /** Confidence (0-1) */
    confidence: number;
    /** Whether this is a repeat concern */
    isRecurring: boolean;
}

/**
 * Scam detection result.
 */
export interface ScamAssessment {
    /** Whether scam is detected */
    isScamDetected: boolean;
    /** Type of scam */
    scamType?: ScamType;
    /** Risk level */
    riskLevel: RiskSeverity;
    /** Red flags detected */
    redFlags: string[];
    /** Recommended response */
    suggestedResponse: string;
    /** Confidence */
    confidence: number;
}

/**
 * Response type for wellbeing issues.
 */
export enum ResponseType {
    /** Normal response with subtle support */
    SUPPORTIVE = 'SUPPORTIVE',
    /** Active comfort and validation */
    COMFORT = 'COMFORT',
    /** Encourage seeking help */
    ENCOURAGE_HELP = 'ENCOURAGE_HELP',
    /** Suggest contacting family/caregiver */
    SUGGEST_CONTACT = 'SUGGEST_CONTACT',
    /** Immediate escalation needed */
    ESCALATE = 'ESCALATE',
    /** Emergency services recommended */
    EMERGENCY = 'EMERGENCY',
}

/**
 * Recommended action.
 */
export interface RecommendedAction {
    /** Action type */
    type: ActionType;
    /** Priority (1=highest) */
    priority: number;
    /** Description */
    description: string;
    /** Target (who to contact) */
    target?: string;
    /** Whether requires user consent */
    requiresConsent: boolean;
}

/**
 * Types of actions.
 */
export enum ActionType {
    /** Log for monitoring */
    LOG = 'LOG',
    /** Notify caregiver */
    NOTIFY_CAREGIVER = 'NOTIFY_CAREGIVER',
    /** Notify family */
    NOTIFY_FAMILY = 'NOTIFY_FAMILY',
    /** Schedule follow-up */
    SCHEDULE_FOLLOWUP = 'SCHEDULE_FOLLOWUP',
    /** Provide resources */
    PROVIDE_RESOURCES = 'PROVIDE_RESOURCES',
    /** Recommend professional help */
    RECOMMEND_PROFESSIONAL = 'RECOMMEND_PROFESSIONAL',
    /** Call emergency services */
    CALL_EMERGENCY = 'CALL_EMERGENCY',
    /** Warn about scam */
    WARN_SCAM = 'WARN_SCAM',
}

/**
 * Escalation contact.
 */
export interface EscalationContact {
    /** Contact name */
    name: string;
    /** Relationship */
    relationship: string;
    /** Phone number */
    phone?: string;
    /** Email */
    email?: string;
    /** Priority (1=primary) */
    priority: number;
    /** When to contact */
    escalationLevel: RiskSeverity;
}

// ============================================================================
// Detection Patterns
// ============================================================================

/**
 * Patterns for detecting wellbeing concerns.
 */
const CONCERN_PATTERNS: Record<WellbeingConcern, { keywords: string[]; phrases: string[]; weight: number }> = {
    [WellbeingConcern.LONELINESS]: {
        keywords: ['lonely', 'alone', 'isolated', 'forgotten', 'nobody', 'abandoned'],
        phrases: [
            'no one calls', 'no one visits', 'all alone', 'nobody cares',
            'no friends left', 'everyone is gone', 'no one to talk to',
            'wish someone would', 'feel invisible', 'nobody remembers',
            'nobody calls',
        ],
        weight: 0.6,
    },
    [WellbeingConcern.DEPRESSION]: {
        keywords: ['depressed', 'hopeless', 'worthless', 'pointless', 'empty', 'numb'],
        phrases: [
            "don't care anymore", 'nothing matters',
            "can't get out of bed", 'no energy', 'no motivation',
            'everything is dark', "don't enjoy anything", 'lost interest',
        ],
        weight: 0.8,
    },
    [WellbeingConcern.SELF_HARM]: {
        keywords: ['hurt myself', 'cutting', 'harm'],
        phrases: [
            'want to hurt myself', 'hurting myself', 'don\'t want to feel',
            'physical pain helps', 'deserve to suffer',
        ],
        weight: 1.0,
    },
    [WellbeingConcern.SUICIDAL_IDEATION]: {
        keywords: ['suicide', 'kill myself', 'end it'],
        phrases: [
            'want to die', "don't want to live", 'don\'t want to live anymore',
            'better off dead', 'end my life', 'not be here', 'give up on life',
            'no reason to go on', "can't take it anymore", "what's the point",
            'everyone would be better without me', 'want to kill myself',
        ],
        weight: 1.0,
    },
    [WellbeingConcern.COGNITIVE_DECLINE]: {
        keywords: ['forget', 'confused', 'lost', 'memory'],
        phrases: [
            'keep forgetting', "can't remember", 'what day is it',
            "don't know where I am", 'getting confused', 'who are you',
            "can't find my way", 'lost again',
        ],
        weight: 0.7,
    },
    [WellbeingConcern.DISORIENTATION]: {
        keywords: ['confused', 'lost', 'where am I', 'disoriented'],
        phrases: [
            "don't know where I am", 'how did I get here',
            "don't recognize", 'what happened', 'who am I',
        ],
        weight: 0.8,
    },
    [WellbeingConcern.MEDICAL_EMERGENCY]: {
        keywords: ['pain', 'hurt', 'blood', 'breathing', 'chest', 'heart'],
        phrases: [
            "can't breathe", 'chest pain', 'heart attack', 'stroke',
            'fell down', 'hit my head', "can't move", 'bleeding badly',
            'need ambulance', 'need help now', 'call 911',
        ],
        weight: 1.0,
    },
    [WellbeingConcern.SUBSTANCE_ABUSE]: {
        keywords: ['drinking', 'drunk', 'pills', 'overdose'],
        phrases: [
            'too many drinks', 'took too many pills', 'need alcohol',
            "can't stop drinking", 'drinking alone',
        ],
        weight: 0.8,
    },
    [WellbeingConcern.ABUSE]: {
        keywords: ['hit me', 'hurts me', 'threatens', 'scared of'],
        phrases: [
            'they hit me', 'hurts me', 'threatens me',
            'takes my money', 'locks me in', 'won\'t let me',
            'scared of them', 'makes me afraid', 'punishes me',
        ],
        weight: 1.0,
    },
    [WellbeingConcern.FINANCIAL_EXPLOITATION]: {
        keywords: ['money', 'bank', 'sent', 'gave'],
        phrases: [
            'sent them money', 'gave my bank details', 'they took',
            'won\'t give me my money', 'controls my finances',
            'made me sign', 'forces me to pay',
        ],
        weight: 0.9,
    },
    [WellbeingConcern.FALL_RISK]: {
        keywords: ['fell', 'fall', 'tripped', 'balance'],
        phrases: [
            'fell down', 'keep falling', 'losing my balance',
            'almost fell', 'can\'t get up', 'fell again',
        ],
        weight: 0.7,
    },
    [WellbeingConcern.DISTRESS]: {
        keywords: ['upset', 'crying', 'scared', 'worried', 'terrible'],
        phrases: [
            'so upset', "can't stop crying", 'very scared',
            'terrible day', 'awful', 'overwhelming',
        ],
        weight: 0.5,
    },
};

/**
 * Patterns for detecting scams.
 */
const SCAM_PATTERNS: Record<ScamType, { keywords: string[]; phrases: string[]; severity: RiskSeverity }> = {
    [ScamType.MONEY_REQUEST]: {
        keywords: ['send money', 'wire', 'gift card', 'western union'],
        phrases: [
            'asked me to send money', 'wants me to wire', 'buy gift cards',
            'send via western union', 'needs money urgently',
        ],
        severity: RiskSeverity.HIGH,
    },
    [ScamType.GOVERNMENT_IMPERSONATION]: {
        keywords: ['IRS', 'social security', 'arrest', 'warrant'],
        phrases: [
            'IRS is calling', 'owe back taxes', 'arrest warrant',
            'social security suspended', 'will be arrested',
            'from the government', 'pay immediately',
        ],
        severity: RiskSeverity.HIGH,
    },
    [ScamType.TECH_SUPPORT]: {
        keywords: ['virus', 'computer problem', 'remote access', 'microsoft'],
        phrases: [
            'computer has virus', 'give me remote access',
            'calling from microsoft', 'fix your computer',
            'your account is hacked', 'computer has a virus',
            'from microsoft', 'from microsoft called',
        ],
        severity: RiskSeverity.MODERATE,
    },
    [ScamType.ROMANCE]: {
        keywords: ['love you', 'soulmate', 'send money', 'stranded'],
        phrases: [
            'fallen in love online', 'never met in person',
            'stranded overseas', 'needs money to visit',
            'sending me gifts', 'investment opportunity together',
        ],
        severity: RiskSeverity.HIGH,
    },
    [ScamType.LOTTERY]: {
        keywords: ['winner', 'lottery', 'prize', 'claim'],
        phrases: [
            "you've won", 'lottery winner', 'claim your prize',
            'pay fee to collect', 'won millions', 'sweepstakes',
        ],
        severity: RiskSeverity.MODERATE,
    },
    [ScamType.GRANDPARENT]: {
        keywords: ['grandchild', 'in trouble', 'jail', 'accident'],
        phrases: [
            'grandchild is in jail', 'had an accident',
            "don't tell anyone", 'needs bail money',
            'send money right away', 'it\'s me grandma',
        ],
        severity: RiskSeverity.CRITICAL,
    },
    [ScamType.MEDICARE]: {
        keywords: ['medicare', 'new card', 'benefits', 'insurance'],
        phrases: [
            'new medicare card', 'verify your medicare',
            'lose your benefits', 'medicare enrollment',
            'free medical supplies',
        ],
        severity: RiskSeverity.MODERATE,
    },
    [ScamType.INVESTMENT]: {
        keywords: ['investment', 'guaranteed returns', 'crypto', 'opportunity'],
        phrases: [
            'guaranteed returns', 'once in a lifetime',
            'secret investment', 'get rich quick',
            'double your money', 'limited time offer',
        ],
        severity: RiskSeverity.HIGH,
    },
    [ScamType.CHARITY]: {
        keywords: ['donation', 'charity', 'help children', 'disaster'],
        phrases: [
            'donate now', 'urgent charity', 'help victims',
            'cash donation preferred',
        ],
        severity: RiskSeverity.MODERATE,
    },
    [ScamType.PHISHING]: {
        keywords: ['password', 'verify account', 'click link', 'suspended'],
        phrases: [
            'verify your account', 'password expired',
            'click this link', 'account suspended',
            'confirm your identity', 'update payment',
        ],
        severity: RiskSeverity.MODERATE,
    },
};

/**
 * Medical misinformation topics to guard against.
 */
const MEDICAL_MISINFORMATION_TOPICS = [
    'miracle cure',
    'doctors don\'t want you to know',
    'stop taking medication',
    'natural cure for',
    'FDA hiding',
    'big pharma conspiracy',
    'cure cancer naturally',
    'alternative to surgery',
    'skip your doctor',
    'better than medicine',
];

// ============================================================================
// Wellbeing Guard Class
// ============================================================================

/**
 * Configuration for the wellbeing guard.
 */
export interface WellbeingGuardConfig {
    /** Minimum confidence for detection */
    minConfidence: number;
    /** Whether to track patterns over time */
    enablePatternTracking: boolean;
    /** Number of occurrences before escalating recurring issues */
    recurrenceThreshold: number;
    /** Escalation contacts */
    escalationContacts: EscalationContact[];
    /** Whether medical disclaimer is required */
    requireMedicalDisclaimer: boolean;
}

const DEFAULT_CONFIG: WellbeingGuardConfig = {
    minConfidence: 0.4,
    enablePatternTracking: true,
    recurrenceThreshold: 3,
    escalationContacts: [],
    requireMedicalDisclaimer: true,
};

/**
 * Wellbeing Guard - Safety system for vulnerable users.
 * 
 * Usage:
 * ```typescript
 * const guard = new WellbeingGuard();
 * 
 * // Assess wellbeing from user input
 * const assessment = guard.assessWellbeing(
 *   "I feel so alone. Nobody calls me anymore.",
 *   emotionalState
 * );
 * 
 * if (assessment.overallRisk >= RiskSeverity.HIGH) {
 *   // Take action
 * }
 * 
 * // Check for scam patterns
 * const scamCheck = guard.detectScam(
 *   "Someone called saying my grandchild needs bail money"
 * );
 * 
 * if (scamCheck.isScamDetected) {
 *   // Warn user
 * }
 * ```
 */
export class WellbeingGuard {
    private config: WellbeingGuardConfig;
    private concernHistory: Map<WellbeingConcern, number[]> = new Map();
    private assessmentLog: WellbeingAssessment[] = [];

    constructor(config?: Partial<WellbeingGuardConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ============================================================================
    // Wellbeing Assessment
    // ============================================================================

    /**
     * Assess user wellbeing from input.
     */
    assessWellbeing(text: string, emotionalState?: EmotionalState): WellbeingAssessment {
        const concerns = this.detectConcerns(text, emotionalState);

        // Determine overall risk
        const overallRisk = this.calculateOverallRisk(concerns);

        // Determine response type
        const responseType = this.determineResponseType(overallRisk, concerns);

        // Generate response
        const suggestedResponse = this.generateWellbeingResponse(concerns, responseType);

        // Build recommended actions
        const recommendedActions = this.buildRecommendedActions(concerns, overallRisk);

        // Calculate confidence
        const confidence = concerns.length > 0
            ? concerns.reduce((sum, c) => sum + c.confidence, 0) / concerns.length
            : 0;

        // Generate risk justification (new logic)
        const riskJustification = concerns.length > 0
            ? `Detected concerns: ${concerns.map(c => `${c.type} (${c.severity})`).join(', ')}`
            : "No significant safety risks detected.";

        const assessment: WellbeingAssessment = {
            overallRisk,
            concerns,
            requiresImmediateAction: overallRisk === RiskSeverity.CRITICAL,
            responseType,
            suggestedResponse,
            recommendedActions,
            confidence,
            timestamp: Date.now(),
            riskJustification, // Added this field
        };

        // Log assessment
        this.assessmentLog.push(assessment);
        if (this.assessmentLog.length > 100) {
            this.assessmentLog = this.assessmentLog.slice(-50);
        }

        return assessment;
    }

    /**
     * Detect specific concerns from text.
     */
    private detectConcerns(text: string, emotionalState?: EmotionalState): DetectedConcern[] {
        const concerns: DetectedConcern[] = [];
        const lowerText = text.toLowerCase();

        for (const [concernType, patterns] of Object.entries(CONCERN_PATTERNS)) {
            const concern = concernType as WellbeingConcern;
            const evidence: string[] = [];
            let score = 0;

            // Check keywords
            for (const keyword of patterns.keywords) {
                if (lowerText.includes(keyword)) {
                    evidence.push(keyword);
                    score += 0.3;
                }
            }

            // Check phrases (higher weight)
            for (const phrase of patterns.phrases) {
                if (lowerText.includes(phrase)) {
                    evidence.push(phrase);
                    score += 0.5;
                }
            }

            // Apply weight
            score *= patterns.weight;

            // Check emotional state correlation
            if (emotionalState) {
                if (concern === WellbeingConcern.LONELINESS &&
                    emotionalState.primaryEmotion === EmotionCategory.LONELINESS) {
                    score += 0.3;
                }
                if (concern === WellbeingConcern.DEPRESSION &&
                    emotionalState.primaryEmotion === EmotionCategory.SADNESS &&
                    emotionalState.intensity >= EmotionIntensity.HIGH) {
                    score += 0.2;
                }
            }

            if (evidence.length > 0 && score >= this.config.minConfidence) {
                // Check if recurring
                const history = this.concernHistory.get(concern) || [];
                const isRecurring = history.length >= this.config.recurrenceThreshold - 1;

                concerns.push({
                    type: concern,
                    severity: this.scoreToConcernSeverity(score),
                    evidence,
                    confidence: Math.min(1, score),
                    isRecurring,
                });

                // Track for pattern detection
                if (this.config.enablePatternTracking) {
                    history.push(Date.now());
                    this.concernHistory.set(concern, history.slice(-10));
                }
            }
        }

        return concerns;
    }

    /**
     * Convert score to severity level.
     */
    private scoreToConcernSeverity(score: number): RiskSeverity {
        if (score >= 0.9) return RiskSeverity.CRITICAL;
        if (score >= 0.7) return RiskSeverity.HIGH;
        if (score >= 0.5) return RiskSeverity.MODERATE;
        if (score >= 0.3) return RiskSeverity.LOW;
        return RiskSeverity.NONE;
    }

    /**
     * Calculate overall risk from concerns.
     */
    private calculateOverallRisk(concerns: DetectedConcern[]): RiskSeverity {
        if (concerns.length === 0) return RiskSeverity.NONE;

        // Critical concerns override everything
        const criticalConcerns = [
            WellbeingConcern.SUICIDAL_IDEATION,
            WellbeingConcern.SELF_HARM,
            WellbeingConcern.MEDICAL_EMERGENCY,
            WellbeingConcern.ABUSE,
        ];

        for (const concern of concerns) {
            if (criticalConcerns.includes(concern.type)) {
                return RiskSeverity.CRITICAL;
            }
        }

        // Otherwise, use highest severity
        const severities = concerns.map(c => c.severity);
        if (severities.includes(RiskSeverity.CRITICAL)) return RiskSeverity.CRITICAL;
        if (severities.includes(RiskSeverity.HIGH)) return RiskSeverity.HIGH;
        if (severities.includes(RiskSeverity.MODERATE)) return RiskSeverity.MODERATE;
        if (severities.includes(RiskSeverity.LOW)) return RiskSeverity.LOW;
        return RiskSeverity.NONE;
    }

    /**
     * Determine appropriate response type.
     */
    private determineResponseType(risk: RiskSeverity, concerns: DetectedConcern[]): ResponseType {
        switch (risk) {
            case RiskSeverity.CRITICAL:
                // Check if emergency vs escalation
                const emergencyConcerns = concerns.filter(c =>
                    c.type === WellbeingConcern.SUICIDAL_IDEATION ||
                    c.type === WellbeingConcern.MEDICAL_EMERGENCY
                );
                return emergencyConcerns.length > 0 ? ResponseType.EMERGENCY : ResponseType.ESCALATE;

            case RiskSeverity.HIGH:
                return ResponseType.SUGGEST_CONTACT;

            case RiskSeverity.MODERATE:
                return ResponseType.ENCOURAGE_HELP;

            case RiskSeverity.LOW:
                return ResponseType.COMFORT;

            default:
                return ResponseType.SUPPORTIVE;
        }
    }

    /**
     * Generate wellbeing response.
     */
    private generateWellbeingResponse(concerns: DetectedConcern[], responseType: ResponseType): string {
        if (concerns.length === 0) {
            return '';
        }

        const primaryConcern = concerns[0];

        // Emergency responses
        if (responseType === ResponseType.EMERGENCY) {
            if (primaryConcern.type === WellbeingConcern.SUICIDAL_IDEATION) {
                return "I'm really concerned about what you're sharing with me. Your life matters, and I want you to know that help is available right now. Please call the National Suicide Prevention Lifeline at 988, or call 911 if you're in immediate danger. Would you like me to help you reach out to someone?";
            }
            if (primaryConcern.type === WellbeingConcern.MEDICAL_EMERGENCY) {
                return "This sounds like it could be a medical emergency. Please call 911 right away, or have someone nearby help you. Your safety is the most important thing right now.";
            }
        }

        // Escalation responses
        if (responseType === ResponseType.ESCALATE) {
            if (primaryConcern.type === WellbeingConcern.ABUSE) {
                return "I'm very concerned about your safety. What you're describing is not okay, and you deserve to be treated with respect and care. Please consider calling the Elder Abuse Hotline at 1-800-677-1116. Would you like to talk to someone who can help?";
            }
            return "I'm concerned about what you're sharing, and I think it's important that someone who can really help knows about this. Would it be okay if we talked about reaching out to someone who cares about you?";
        }

        // Suggest contact
        if (responseType === ResponseType.SUGGEST_CONTACT) {
            return "What you're going through sounds really difficult. I think it would help to talk to someone you trust - maybe a family member, friend, or your doctor. They care about you and would want to know how you're feeling.";
        }

        // Encourage help
        if (responseType === ResponseType.ENCOURAGE_HELP) {
            return "I hear how hard things have been for you. It takes courage to share these feelings. There are people who can help - would you be open to talking to someone about this?";
        }

        // Comfort response
        if (responseType === ResponseType.COMFORT) {
            switch (primaryConcern.type) {
                case WellbeingConcern.LONELINESS:
                    return "I understand that feeling of loneliness can be really painful. I want you to know that I'm here, and our conversations matter to me. You're not alone.";
                case WellbeingConcern.DEPRESSION:
                    return "It sounds like things have been really heavy lately. Those feelings are valid, and it's okay to not be okay. I'm here to listen whenever you need to talk.";
                default:
                    return "I hear you, and I'm here for you. Whatever you're going through, you don't have to face it alone.";
            }
        }

        return "I'm here with you.";
    }

    /**
     * Build recommended actions.
     */
    private buildRecommendedActions(concerns: DetectedConcern[], risk: RiskSeverity): RecommendedAction[] {
        const actions: RecommendedAction[] = [];

        // Always log
        actions.push({
            type: ActionType.LOG,
            priority: 3,
            description: 'Log concern for monitoring',
            requiresConsent: false,
        });

        if (risk === RiskSeverity.CRITICAL) {
            // Check for emergency services
            const emergencyConcerns = concerns.filter(c =>
                c.type === WellbeingConcern.SUICIDAL_IDEATION ||
                c.type === WellbeingConcern.MEDICAL_EMERGENCY
            );

            if (emergencyConcerns.length > 0) {
                actions.push({
                    type: ActionType.CALL_EMERGENCY,
                    priority: 1,
                    description: 'Emergency services may be needed',
                    target: '911',
                    requiresConsent: false,
                });
            }

            actions.push({
                type: ActionType.NOTIFY_CAREGIVER,
                priority: 1,
                description: 'Notify primary caregiver immediately',
                requiresConsent: false,
            });
        }

        if (risk === RiskSeverity.HIGH) {
            actions.push({
                type: ActionType.NOTIFY_FAMILY,
                priority: 2,
                description: 'Notify family contact',
                requiresConsent: true,
            });

            actions.push({
                type: ActionType.RECOMMEND_PROFESSIONAL,
                priority: 2,
                description: 'Recommend professional support',
                requiresConsent: false,
            });
        }

        if (risk === RiskSeverity.MODERATE) {
            actions.push({
                type: ActionType.SCHEDULE_FOLLOWUP,
                priority: 2,
                description: 'Schedule follow-up check-in',
                requiresConsent: false,
            });

            actions.push({
                type: ActionType.PROVIDE_RESOURCES,
                priority: 2,
                description: 'Provide relevant support resources',
                requiresConsent: false,
            });
        }

        // Sort by priority
        return actions.sort((a, b) => a.priority - b.priority);
    }

    // ============================================================================
    // Scam Detection
    // ============================================================================

    /**
     * Detect potential scams in user input.
     */
    detectScam(text: string): ScamAssessment {
        const lowerText = text.toLowerCase();
        const redFlags: string[] = [];
        let detectedType: ScamType | undefined;
        let highestSeverity = RiskSeverity.NONE;
        let maxScore = 0;

        for (const [scamType, patterns] of Object.entries(SCAM_PATTERNS)) {
            let score = 0;

            for (const keyword of patterns.keywords) {
                if (lowerText.includes(keyword)) {
                    redFlags.push(keyword);
                    score += 0.3;
                }
            }

            for (const phrase of patterns.phrases) {
                if (lowerText.includes(phrase)) {
                    redFlags.push(phrase);
                    score += 0.5;
                }
            }

            if (score > maxScore) {
                maxScore = score;
                detectedType = scamType as ScamType;
                highestSeverity = patterns.severity;
            }
        }

        const isScamDetected = maxScore >= 0.4;

        return {
            isScamDetected,
            scamType: isScamDetected ? detectedType : undefined,
            riskLevel: isScamDetected ? highestSeverity : RiskSeverity.NONE,
            redFlags: [...new Set(redFlags)],
            suggestedResponse: this.generateScamWarning(detectedType, redFlags),
            confidence: Math.min(1, maxScore),
        };
    }

    /**
     * Generate scam warning response.
     */
    private generateScamWarning(scamType?: ScamType, redFlags: string[] = []): string {
        if (!scamType) {
            return '';
        }

        const baseWarning = "I want to make sure you're safe. What you're describing has some warning signs that concern me.";

        switch (scamType) {
            case ScamType.GRANDPARENT:
                return `${baseWarning} This sounds like it could be what's called a "grandparent scam" where criminals pretend to be grandchildren in trouble. Please do NOT send any money. Instead, try calling your grandchild directly at a number you know is theirs. Would you like help verifying this?`;

            case ScamType.GOVERNMENT_IMPERSONATION:
                return `${baseWarning} The IRS and Social Security never call and demand immediate payment. This is almost certainly a scam. Real government agencies communicate by mail first. Please hang up and do not give any personal information.`;

            case ScamType.MONEY_REQUEST:
                return `${baseWarning} Anytime someone pressures you to send money quickly, especially via gift cards or wire transfers, it's usually a scam. Please don't send any money until you've talked to a family member or trusted friend about this.`;

            case ScamType.TECH_SUPPORT:
                return `${baseWarning} Legitimate companies like Microsoft never call you about computer problems. This is a very common scam. Please don't give them access to your computer or any payment information.`;

            case ScamType.ROMANCE:
                return `${baseWarning} Online romance scams are unfortunately very common. If someone you've never met in person is asking for money, please be very cautious. Consider talking to a family member about this before doing anything.`;

            default:
                return `${baseWarning} Before taking any action, please talk to a family member or someone you trust. I want to make sure no one takes advantage of you.`;
        }
    }

    // ============================================================================
    // Medical Safety
    // ============================================================================

    /**
     * Check for medical misinformation in text.
     */
    checkMedicalMisinformation(text: string): {
        detected: boolean;
        topics: string[];
        disclaimer: string;
    } {
        const lowerText = text.toLowerCase();
        const detectedTopics: string[] = [];

        for (const topic of MEDICAL_MISINFORMATION_TOPICS) {
            if (lowerText.includes(topic)) {
                detectedTopics.push(topic);
            }
        }

        return {
            detected: detectedTopics.length > 0,
            topics: detectedTopics,
            disclaimer: this.config.requireMedicalDisclaimer
                ? "I'm not a medical professional, and I can't give medical advice. Please always consult with your doctor about any health concerns or before making changes to your medications or treatment."
                : '',
        };
    }

    /**
     * Add medical disclaimer to response if needed.
     */
    addMedicalDisclaimer(response: string, isMedicalTopic: boolean): string {
        if (isMedicalTopic && this.config.requireMedicalDisclaimer) {
            return `${response}\n\nRemember: I'm not a doctor, and this isn't medical advice. Please consult with your healthcare provider for any medical concerns.`;
        }
        return response;
    }

    // ============================================================================
    // Escalation Management
    // ============================================================================

    /**
     * Add escalation contact.
     */
    addEscalationContact(contact: EscalationContact): void {
        this.config.escalationContacts.push(contact);
        this.config.escalationContacts.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Get contacts for a given risk level.
     */
    getContactsForRisk(risk: RiskSeverity): EscalationContact[] {
        return this.config.escalationContacts.filter(
            c => c.escalationLevel <= risk
        );
    }

    /**
     * Get primary contact.
     */
    getPrimaryContact(): EscalationContact | undefined {
        return this.config.escalationContacts.find(c => c.priority === 1);
    }

    // ============================================================================
    // History & Patterns
    // ============================================================================

    /**
     * Get concern history summary.
     */
    getConcernHistory(): Map<WellbeingConcern, number> {
        const summary = new Map<WellbeingConcern, number>();
        for (const [concern, timestamps] of this.concernHistory) {
            summary.set(concern, timestamps.length);
        }
        return summary;
    }

    /**
     * Get recurring concerns.
     */
    getRecurringConcerns(): WellbeingConcern[] {
        const recurring: WellbeingConcern[] = [];
        for (const [concern, timestamps] of this.concernHistory) {
            if (timestamps.length >= this.config.recurrenceThreshold) {
                recurring.push(concern);
            }
        }
        return recurring;
    }

    /**
     * Get recent assessments.
     */
    getRecentAssessments(limit: number = 10): WellbeingAssessment[] {
        return this.assessmentLog.slice(-limit);
    }

    /**
     * Clear concern history.
     */
    clearHistory(): void {
        this.concernHistory.clear();
        this.assessmentLog = [];
    }
}
