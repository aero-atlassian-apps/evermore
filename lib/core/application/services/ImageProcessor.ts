import { ImagePort, ImageAnalysisRequest, ImageAnalysisResult, ImageGenerationRequest, ImageGenerationResult } from '../ports/ImagePort';
import { WellbeingGuard } from '../agent/safety/WellbeingGuard';
import { RiskSeverity } from '../agent/safety/WellbeingGuard';
import { EmotionCategory, EmotionIntensity, EmotionalState } from '../agent/persona/EmpathyEngine';

export class ImageProcessor {
    constructor(
        private imagePort: ImagePort,
        private wellbeingGuard: WellbeingGuard
    ) { }

    private getDefaultEmotionalState(): EmotionalState {
        return {
            primaryEmotion: EmotionCategory.NEUTRAL,
            confidence: 1.0,
            intensity: EmotionIntensity.LOW,
            triggers: [],
            valence: 0,
            arousal: 0,
            needsSupport: false,
            recommendEscalation: false,
            analysisDetails: {
                textSignals: [],
                combinedScore: 0,
                timestamp: Date.now()
            }
        };
    }

    /**
     * Analyzes an image while ensuring safety and senior-specific context.
     */
    async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
        // Simple safety check on the prompt if provided
        if (request.prompt) {
            const safetyAssessment = this.wellbeingGuard.assessWellbeing(request.prompt, this.getDefaultEmotionalState());

            if (safetyAssessment.overallRisk === RiskSeverity.HIGH || safetyAssessment.overallRisk === RiskSeverity.CRITICAL) {
                return {
                    description: "Analysis blocked due to safety concerns.",
                    safetyFlag: true,
                    safetyReason: safetyAssessment.riskJustification
                };
            }
        }

        const result = await this.imagePort.analyzeImage(request);

        // Post-analysis safety check on the description
        if (result.description) {
            const descriptionAssessment = this.wellbeingGuard.assessWellbeing(result.description, this.getDefaultEmotionalState());

            if (descriptionAssessment.overallRisk === RiskSeverity.HIGH || descriptionAssessment.overallRisk === RiskSeverity.CRITICAL) {
                return {
                    ...result,
                    description: "Content flagged as potentially harmful or distressing.",
                    safetyFlag: true,
                    safetyReason: "Visual content safety violation detected."
                };
            }
        }

        return result;
    }

    /**
     * Generates an image with semantic intent handling and reproducibility.
     */
    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
        // Safety check on generation prompt
        const safetyAssessment = this.wellbeingGuard.assessWellbeing(request.prompt, this.getDefaultEmotionalState());

        if (safetyAssessment.overallRisk === RiskSeverity.HIGH || safetyAssessment.overallRisk === RiskSeverity.CRITICAL) {
            throw new Error(`Image generation blocked: ${safetyAssessment.riskJustification}`);
        }

        // Augment prompt with senior-friendly style constraints if not strictly defined
        let augmentedPrompt = request.prompt;
        if (request.style === 'realistic' && !augmentedPrompt.toLowerCase().includes('clear') && !augmentedPrompt.toLowerCase().includes('simple')) {
            augmentedPrompt += ", high contrast, clear focus, simple background, senior-friendly aesthetic";
        }

        const result = await this.imagePort.generateImage({
            ...request,
            prompt: augmentedPrompt
        });

        return {
            ...result,
            promptUsed: augmentedPrompt
        };
    }
}
