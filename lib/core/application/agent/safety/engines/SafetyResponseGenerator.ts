import { WellbeingConcern, DetectedConcern, RiskSeverity, ResponseType, RecommendedAction, ActionType } from '../types';

export class SafetyResponseGenerator {
    generateResponse(concerns: DetectedConcern[], responseType: ResponseType): string {
        if (concerns.length === 0) return '';
        const primaryConcern = concerns[0];

        if (responseType === ResponseType.EMERGENCY) {
            if (primaryConcern.type === WellbeingConcern.SUICIDAL_IDEATION) {
                return "I'm really concerned about what you're sharing. Your life matters. Please call the National Suicide Prevention Lifeline at 988, or 911 if in immediate danger.";
            }
            if (primaryConcern.type === WellbeingConcern.MEDICAL_EMERGENCY) {
                return "This sounds like a medical emergency. Please call 911 right away. Your safety is the most important thing.";
            }
        }

        if (responseType === ResponseType.ESCALATE) {
            if (primaryConcern.type === WellbeingConcern.ABUSE) {
                return "I'm very concerned about your safety. What you're describing is not okay. Please consider calling the Elder Abuse Hotline at 1-800-677-1116. Would you like to talk to someone who can help?";
            }
            return "I'm concerned about what you're sharing. It might be helpful to talk to someone who can provide more support. Would you like to reach out to a trusted contact?";
        }

        if (responseType === ResponseType.SUGGEST_CONTACT) {
            return "This sounds difficult. I think talking to someone you trust, like a doctor or family member, would be a good next step.";
        }

        if (responseType === ResponseType.COMFORT) {
            if (primaryConcern.type === WellbeingConcern.LONELINESS) return "I understand that feeling lonely is painful. I'm here, and our conversations matter to me.";
            return "I hear you, and I'm here for you. You don't have to face this alone.";
        }

        return "I'm here for you.";
    }

    buildActions(concerns: DetectedConcern[], risk: RiskSeverity): RecommendedAction[] {
        const actions: RecommendedAction[] = [{
            type: ActionType.LOG,
            priority: 3,
            description: 'Log concern for monitoring',
            requiresConsent: false,
        }];

        if (risk === RiskSeverity.CRITICAL) {
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
        }

        return actions;
    }
}
