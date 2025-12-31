
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateChapterUseCase } from '../../lib/core/application/use-cases/GenerateChapterUseCase';
import { ExportBookUseCase } from '../../lib/core/application/use-cases/ExportBookUseCase';
import { AgenticStorybookOrchestrator } from '../../lib/infrastructure/adapters/storybook/AgenticStorybookOrchestrator';
import { Chapter } from '../../lib/core/domain/entities/Chapter';
import { StorybookData } from '../../lib/core/application/ports/StorybookGeneratorPort';

// Mocks
const mockChapterRepository = {
    create: vi.fn(),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    findBySessionId: vi.fn(),
    update: vi.fn(),
};

const mockSessionRepository = {
    findById: vi.fn(),
};

const mockUserRepository = {
    findById: vi.fn(),
};

const mockChapterGenerator = {
    generateChapter: vi.fn(),
};

const mockEmailService = {
    sendChapterNotification: vi.fn(),
};

const mockLLM = {
    generateText: vi.fn(),
    generateJson: vi.fn().mockResolvedValue({
        isLikelyHallucination: false,
        confidence: 0.9,
        flaggedSegments: [],
        suggestedCorrections: [],
        summary: "No hallucinations detected",
        sourcesChecked: []
    }),
};

const mockPDFService = {
    generateBook: vi.fn(),
    generateIllustratedStorybook: vi.fn(),
};

const mockImageGenerator = {
    isAvailable: vi.fn().mockResolvedValue(true),
    generateStorybookImages: vi.fn().mockResolvedValue(new Map())
};

const mockAgentMemoryFactory = vi.fn().mockReturnValue({
    query: vi.fn().mockResolvedValue([]),
    add: vi.fn(),
    count: vi.fn().mockResolvedValue(0)
});

// Mock Dynamic Imports
vi.mock('@/lib/infrastructure/di/container', () => ({
    speechProvider: {},
    chapterRepository: {}
}));

vi.mock('../../lib/core/application/use-cases/GenerateChapterAudioUseCase', () => ({
    GenerateChapterAudioUseCase: class {
        constructor() { }
        execute() { return Promise.resolve(); }
    }
}));

describe('Agentic Orchestration Remediation', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Phase 1 & 2: Generation & Memory', () => {
        it('should trigger storybook generation after chapter creation', async () => {
            // Setup
            const orchestrator = new AgenticStorybookOrchestrator(
                mockChapterRepository as any,
                mockUserRepository as any,
                mockLLM as any,
                mockImageGenerator as any
            );

            // Spy on the generateStorybook method we are interested in
            const generateSpy = vi.spyOn(orchestrator, 'generateStorybook');
            // Mock implementation to avoid running full logic
            generateSpy.mockResolvedValue({} as StorybookData);

            const useCase = new GenerateChapterUseCase(
                mockChapterRepository as any,
                mockSessionRepository as any,
                mockUserRepository as any,
                mockChapterGenerator as any,
                mockEmailService as any,
                mockLLM as any,
                orchestrator,
                mockAgentMemoryFactory as any
            );

            // Mock Data
            mockSessionRepository.findById.mockResolvedValue({
                userId: 'user1',
                transcriptRaw: [{ speaker: 'User', text: 'This is a much longer memory about my childhood that should definitely pass the fifty character limit required by the system validation.' }]
            });
            mockChapterRepository.findBySessionId.mockResolvedValue([]);
            mockChapterRepository.findByUserId.mockResolvedValue([]); // Day 0
            mockChapterGenerator.generateChapter.mockResolvedValue({
                chapter: 'Title: Test Chapter\n\nThis is a valid chapter content that is definitely long enough to pass the validation check which requires at least fifty characters of text content.',
                atoms: { narrativeArc: 'Test Arc' }
            });
            mockChapterRepository.create.mockResolvedValue({ id: 'chap1' });

            // Execute
            await useCase.execute('session1');

            // Assert - generateStorybook now receives a context object as second argument
            expect(generateSpy).toHaveBeenCalledWith('chap1', expect.any(Object));
        });

        it('should use User Profile for context on Day 0 (safe cold start)', async () => {
            const orchestrator = new AgenticStorybookOrchestrator(
                mockChapterRepository as any,
                mockUserRepository as any,
                mockLLM as any
            );
            const useCase = new GenerateChapterUseCase(
                mockChapterRepository as any,
                mockSessionRepository as any,
                mockUserRepository as any,
                mockChapterGenerator as any,
                mockEmailService as any,
                mockLLM as any,
                orchestrator,
                mockAgentMemoryFactory as any
            );

            mockSessionRepository.findById.mockResolvedValue({
                userId: 'user1',
                transcriptRaw: [{ speaker: 'User', text: 'I remember the very first time I saw the ocean, it was blue and vast and endless and I felt so small yet so connected to the world.' }]
            });
            // FORCE DAY 0: No previous chapters
            mockChapterRepository.findByUserId.mockResolvedValue([]);
            mockChapterGenerator.generateChapter.mockResolvedValue({ chapter: 'Title: Ocean Memory\n\nThis is another valid chapter content that is definitely long enough to pass the validation check which requires at least fifty characters of text content.', atoms: { narrativeArc: 'The First Ocean Memory' } });
            mockChapterRepository.create.mockResolvedValue({ id: 'chap1' });

            // Mock User Profile to be accessed
            mockUserRepository.findById.mockResolvedValue({ name: 'Alice' });

            await useCase.execute('session1');

            // Verify Repository was called to check previous chapters
            expect(mockChapterRepository.findByUserId).toHaveBeenCalledWith('user1');
            // Verify User Repository was called (fallback logic)
            expect(mockUserRepository.findById).toHaveBeenCalledWith('user1');
        });
    });

    describe('Persistence', () => {
        it('should save generated storybook to chapter metadata', async () => {
            const orchestrator = new AgenticStorybookOrchestrator(
                mockChapterRepository as any,
                mockUserRepository as any,
                mockLLM as any
            );

            // Mock dependencies for internal flow
            mockChapterRepository.findById.mockResolvedValue({
                title: 'Test',
                content: 'Start',
                metadata: { existing: true }
            });
            mockLLM.generateText.mockResolvedValue('Children Story');
            mockLLM.generateJson.mockResolvedValue({ layouts: [] }); // formatting/layout response

            // Run
            await orchestrator.generateStorybook('chap1');

            // Assert Update called with metadata
            expect(mockChapterRepository.update).toHaveBeenCalledWith(
                'chap1',
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        existing: true,
                        storybook: expect.anything()
                    })
                })
            );
        });
    });

    describe('Phase 3: Export', () => {
        it('should use generateIllustratedStorybook when storybook metadata exists', async () => {
            const useCase = new ExportBookUseCase(
                mockChapterRepository as any,
                mockPDFService as any
            );

            // Mock chapter WITH storybook metadata
            mockChapterRepository.findByUserId.mockResolvedValue([{
                title: 'Chap 1',
                content: 'Content',
                metadata: {
                    storybook: { title: 'The Illustrated Story' }
                }
            }]);

            // Mock the specialized method on PDF Service
            mockPDFService.generateIllustratedStorybook.mockResolvedValue(Buffer.from('PDF'));

            await useCase.execute('user1');

            // Assert
            expect(mockPDFService.generateIllustratedStorybook).toHaveBeenCalled();
            expect(mockPDFService.generateBook).not.toHaveBeenCalled();
        });

        it('should fallback to generateBook when no storybook metadata', async () => {
            const useCase = new ExportBookUseCase(
                mockChapterRepository as any,
                mockPDFService as any
            );

            // Mock chapter WITHOUT storybook metadata
            mockChapterRepository.findByUserId.mockResolvedValue([{
                title: 'Chap 1',
                content: 'Content',
                metadata: {}
            }]);

            await useCase.execute('user1');

            // Assert
            expect(mockPDFService.generateBook).toHaveBeenCalled();
            expect(mockPDFService.generateIllustratedStorybook).not.toHaveBeenCalled();
        });
    });
});
