import { SessionRepository } from '../../domain/repositories/SessionRepository';
import { LLMPort } from '../ports/LLMPort';
import { SpeechPort } from '../ports/SpeechPort';
import { VectorStorePort } from '../ports/VectorStorePort';

// NOTE: imageAnalysisAgent is imported lazily to avoid circular dependency issues
// when tests import this file before container is fully initialized

export class AnalyzeSessionImageUseCase {
    constructor(
        private sessionRepository: SessionRepository,
        private llm: LLMPort,
        private speech: SpeechPort,
        private vectorStore: VectorStorePort
    ) { }

    async execute(sessionId: string, imageBase64: string, mimeType: string): Promise<{ text: string; audioBase64: string }> {
        const session = await this.sessionRepository.findById(sessionId);
        if (!session) throw new Error('Session not found');

        const transcript = JSON.parse(session.transcriptRaw || '[]');

        // 1. Agentic Image Analysis
        // Uses AgenticImageAnalysisAgent for context-aware understanding and trigger generation
        // Lazy import to avoid circular dependency with container
        const { imageAnalysisAgent } = await import('@/lib/infrastructure/di/container');

        try {
            const analysis = await imageAnalysisAgent.analyzeAndTrigger(imageBase64, mimeType);

            // Add implicit user action to transcript (Context grounding)
            transcript.push({
                id: `msg-${Date.now()}`,
                speaker: 'user',
                text: `[User showed a photo]: ${analysis.description}`,
                timestamp: new Date().toISOString(),
                isSystemEvent: true
            });

            // 2. Use Agent-Generated Trigger
            const responseText = analysis.conversationalTrigger;

            // 3. Generate Audio
            const audioBuffer = await this.speech.textToSpeech(responseText, { style: 'conversational' });

            // 4. Update Transcript with Agent Response
            transcript.push({
                id: `msg-${Date.now() + 1}`,
                speaker: 'agent',
                text: responseText,
                timestamp: new Date().toISOString(),
                strategy: 'visual_trigger',
                sentiment: analysis.emotionalVibe
            });

            session.transcriptRaw = JSON.stringify(transcript);
            await this.sessionRepository.update(session);

            return {
                text: responseText,
                audioBase64: audioBuffer.toString('base64')
            };
        } catch (error: any) {
            throw new Error(`Image analysis failed: ${error.message}`);
        }
    }
}
