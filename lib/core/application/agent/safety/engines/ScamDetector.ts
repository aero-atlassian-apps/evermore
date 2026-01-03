import { ScamType, ScamAssessment, RiskSeverity } from '../types';

export const SCAM_PATTERNS: Record<ScamType, { keywords: string[]; phrases: string[]; severity: RiskSeverity }> = {
    [ScamType.MONEY_REQUEST]: {
        keywords: ['send money', 'wire', 'gift card', 'western union'],
        phrases: ['asked me to send money', 'wants me to wire', 'buy gift cards'],
        severity: RiskSeverity.HIGH,
    },
    [ScamType.GOVERNMENT_IMPERSONATION]: {
        keywords: ['IRS', 'social security', 'arrest'],
        phrases: ['IRS is calling', 'owe back taxes', 'arrest warrant'],
        severity: RiskSeverity.HIGH,
    },
    [ScamType.TECH_SUPPORT]: {
        keywords: ['virus', 'computer problem', 'remote access'],
        phrases: ['computer has virus', 'give me remote access', 'calling from microsoft'],
        severity: RiskSeverity.MODERATE,
    },
    [ScamType.ROMANCE]: {
        keywords: ['love you', 'soulmate', 'send money'],
        phrases: ['fallen in love online', 'never met in person', 'needs money to visit'],
        severity: RiskSeverity.HIGH,
    },
    [ScamType.LOTTERY]: {
        keywords: ['winner', 'lottery', 'prize'],
        phrases: ["you've won", 'lottery winner', 'claim your prize'],
        severity: RiskSeverity.MODERATE,
    },
    [ScamType.GRANDPARENT]: {
        keywords: ['grandchild', 'jail', 'accident'],
        phrases: ['grandchild is in jail', 'had an accident', 'needs bail money'],
        severity: RiskSeverity.CRITICAL,
    },
    [ScamType.MEDICARE]: {
        keywords: ['medicare', 'benefits'],
        phrases: ['new medicare card', 'verify your medicare'],
        severity: RiskSeverity.MODERATE,
    },
    [ScamType.INVESTMENT]: {
        keywords: ['investment', 'guaranteed returns', 'crypto'],
        phrases: ['guaranteed returns', 'once in a lifetime', 'get rich quick'],
        severity: RiskSeverity.HIGH,
    },
    [ScamType.CHARITY]: {
        keywords: ['donation', 'charity'],
        phrases: ['donate now', 'urgent charity'],
        severity: RiskSeverity.MODERATE,
    },
    [ScamType.PHISHING]: {
        keywords: ['password', 'verify account'],
        phrases: ['verify your account', 'password expired', 'confirm your identity'],
        severity: RiskSeverity.MODERATE,
    },
};

export class ScamDetector {
    detect(text: string): ScamAssessment {
        const lowerText = text.toLowerCase();
        for (const [scamType, patterns] of Object.entries(SCAM_PATTERNS)) {
            const evidence: string[] = [];
            for (const keyword of patterns.keywords) {
                if (lowerText.includes(keyword)) evidence.push(keyword);
            }
            for (const phrase of patterns.phrases) {
                if (lowerText.includes(phrase)) evidence.push(phrase);
            }

            if (evidence.length > 0) {
                return {
                    isScamDetected: true,
                    scamType: scamType as ScamType,
                    riskLevel: patterns.severity,
                    redFlags: evidence,
                    suggestedResponse: "This looks like a potential scam. Please do not send money or share personal information.",
                    confidence: 0.8
                };
            }
        }

        return {
            isScamDetected: false,
            riskLevel: RiskSeverity.NONE,
            redFlags: [],
            suggestedResponse: '',
            confidence: 1.0
        };
    }
}
