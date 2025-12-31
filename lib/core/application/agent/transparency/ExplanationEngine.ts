/**
 * Explanation Engine - Provides transparency for AI actions.
 */

export enum ConfidenceLevel {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH'
}

export enum SourceType {
    MEMORY = 'MEMORY',
    EXTERNAL = 'EXTERNAL',
    INFERENCE = 'INFERENCE'
}

export interface ExplanationSource {
    type: SourceType;
    description: string;
    reliability: 'low' | 'medium' | 'high';
}

export class ExplanationEngine {
    createExplainableResponse(text: string, sources: ExplanationSource[], confidence: ConfidenceLevel): {
        shouldOfferExplanation: boolean;
        explanations: { text: string }[];
    } {
        return {
            shouldOfferExplanation: false,
            explanations: []
        };
    }
}
