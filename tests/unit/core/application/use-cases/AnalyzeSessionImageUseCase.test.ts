import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionRepository } from '@/lib/core/domain/repositories/SessionRepository';
import { LLMPort } from '@/lib/core/application/ports/LLMPort';
import { SpeechPort } from '@/lib/core/application/ports/SpeechPort';
import { VectorStorePort } from '@/lib/core/application/ports/VectorStorePort';

// Mock container BEFORE importing the use case to prevent circular dependency
const mockImageAnalysisAgent = {
    analyzeAndTrigger: vi.fn(),
};

vi.mock('@/lib/infrastructure/di/container', () => ({
    imageAnalysisAgent: mockImageAnalysisAgent,
    speechProvider: {},
    chapterRepository: {},
}));

// Import after mock setup
import { AnalyzeSessionImageUseCase } from '@/lib/core/application/use-cases/AnalyzeSessionImageUseCase';

describe('AnalyzeSessionImageUseCase', () => {
    let useCase: AnalyzeSessionImageUseCase;
    let mockSessionRepo: SessionRepository;
    let mockLlm: LLMPort;
    let mockSpeech: SpeechPort;
    let mockVectorStore: VectorStorePort;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSessionRepo = {
            findById: vi.fn().mockResolvedValue({
                id: 'session1',
                userId: 'user1',
                transcriptRaw: '[]',
            }),
            update: vi.fn(),
        } as any;

        mockLlm = {
            analyzeImage: vi.fn(),
            generateJson: vi.fn(),
        } as any;

        mockSpeech = {
            textToSpeech: vi.fn().mockResolvedValue(Buffer.from('audio')),
        } as any;

        mockVectorStore = {
            retrieveContext: vi.fn(),
        } as any;

        // Setup default mock for imageAnalysisAgent
        mockImageAnalysisAgent.analyzeAndTrigger.mockResolvedValue({
            description: 'A photo of a dog',
            conversationalTrigger: 'Tell me about the dog.',
            detectedEntities: ['dog'],
            emotionalVibe: 'curious',
        });

        useCase = new AnalyzeSessionImageUseCase(mockSessionRepo, mockLlm, mockSpeech, mockVectorStore);
    });

    it('should analyze image and generate audio response', async () => {
        const result = await useCase.execute('session1', 'base64image', 'image/jpeg');

        expect(mockImageAnalysisAgent.analyzeAndTrigger).toHaveBeenCalledWith('base64image', 'image/jpeg');
        expect(mockSpeech.textToSpeech).toHaveBeenCalledWith('Tell me about the dog.', { style: 'conversational' });
        expect(result.text).toBe('Tell me about the dog.');
        expect(result.audioBase64).toBe(Buffer.from('audio').toString('base64'));
    });

    it('should update session with transcript including image analysis', async () => {
        await useCase.execute('session1', 'base64image', 'image/jpeg');

        expect(mockSessionRepo.update).toHaveBeenCalledWith(
            expect.objectContaining({
                transcriptRaw: expect.stringContaining('User showed a photo')
            })
        );
    });

    it('should throw error when session not found', async () => {
        (mockSessionRepo.findById as any).mockResolvedValue(null);

        await expect(useCase.execute('session1', 'base64image', 'image/jpeg'))
            .rejects.toThrow('Session not found');
    });

    it('should throw error when image analysis fails', async () => {
        mockImageAnalysisAgent.analyzeAndTrigger.mockRejectedValue(new Error('API error'));

        await expect(useCase.execute('session1', 'base64image', 'image/jpeg'))
            .rejects.toThrow('Image analysis failed: API error');
    });
});
