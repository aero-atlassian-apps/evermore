import { WellbeingConcern, DetectedConcern, RiskSeverity } from '../types';
import { EmotionCategory, EmotionalState, EmotionIntensity } from '../../persona/EmpathyEngine';

/**
 * Patterns for detecting wellbeing concerns.
 */
export const CONCERN_PATTERNS: Record<WellbeingConcern, { keywords: string[]; phrases: string[]; weight: number }> = {
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

export class ConcernDetector {
    constructor(
        private minConfidence: number,
        private recurrenceThreshold: number,
        private concernHistory: Map<WellbeingConcern, number[]>
    ) { }

    detect(text: string, emotionalState?: EmotionalState): DetectedConcern[] {
        const concerns: DetectedConcern[] = [];
        const lowerText = text.toLowerCase();

        for (const [concernType, patterns] of Object.entries(CONCERN_PATTERNS)) {
            const concern = concernType as WellbeingConcern;
            const evidence: string[] = [];
            let score = 0;

            for (const keyword of patterns.keywords) {
                if (lowerText.includes(keyword)) {
                    evidence.push(keyword);
                    score += 0.3;
                }
            }

            for (const phrase of patterns.phrases) {
                if (lowerText.includes(phrase)) {
                    evidence.push(phrase);
                    score += 0.5;
                }
            }

            score *= patterns.weight;

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

            if (evidence.length > 0 && score >= this.minConfidence) {
                const history = this.concernHistory.get(concern) || [];
                const isRecurring = history.length >= this.recurrenceThreshold - 1;

                concerns.push({
                    type: concern,
                    severity: this.scoreToSeverity(score),
                    evidence,
                    confidence: Math.min(1, score),
                    isRecurring,
                });
            }
        }

        return concerns;
    }

    private scoreToSeverity(score: number): RiskSeverity {
        if (score >= 0.9) return RiskSeverity.CRITICAL;
        if (score >= 0.7) return RiskSeverity.HIGH;
        if (score >= 0.5) return RiskSeverity.MODERATE;
        if (score >= 0.3) return RiskSeverity.LOW;
        return RiskSeverity.NONE;
    }
}
