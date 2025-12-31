import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateChapterUseCase } from '@/lib/core/application/use-cases/GenerateChapterUseCase';
import { AgentMemoryPort } from '@/lib/core/application/ports/AgentMemoryPort';
import { ChapterRepository } from '@/lib/core/domain/repositories/ChapterRepository';
import { SessionRepository } from '@/lib/core/domain/repositories/SessionRepository';
import { UserRepository } from '@/lib/core/domain/repositories/UserRepository';
import { ChapterGeneratorPort } from '@/lib/core/application/ports/ChapterGeneratorPort';
import { EmailServicePort } from '@/lib/core/application/ports/EmailServicePort';
import { LLMPort } from '@/lib/core/application/ports/LLMPort';
import { StorybookGeneratorPort } from '@/lib/core/application/ports/StorybookGeneratorPort';
import { MemoryType, MemoryImportance } from '@/lib/core/application/agent/memory/AgentMemory';

// Mock container to prevent circular dependency issues during test loading
vi.mock('@/lib/infrastructure/di/container', () => ({
    speechProvider: {},
    chapterRepository: {},
    imageAnalysisAgent: { analyzeAndTrigger: vi.fn() },
}));

// Mocks
const mockChapterRepository = {
    findBySessionId: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn((c) => Promise.resolve(c)),
} as unknown as ChapterRepository;

const mockSessionRepository = {
    findById: vi.fn(),
} as unknown as SessionRepository;

const mockUserRepository = {
    findById: vi.fn(),
} as unknown as UserRepository;

const mockChapterGenerator = {
    generateChapter: vi.fn(),
} as unknown as ChapterGeneratorPort;

const mockEmailService = {
    sendChapterNotification: vi.fn(),
} as unknown as EmailServicePort;

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
} as unknown as LLMPort;

const mockStorybookGenerator = {
    generateStorybook: vi.fn().mockResolvedValue({}),
} as unknown as StorybookGeneratorPort;

const mockAgentMemory = {
    store: vi.fn(),
    get: vi.fn(),
    query: vi.fn(),
    getWorkingMemory: vi.fn().mockReturnValue([]),
} as unknown as AgentMemoryPort;

describe('GenerateChapterUseCase with Memory', () => {
    let useCase: GenerateChapterUseCase;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mocks
        (mockSessionRepository.findById as any).mockResolvedValue({
            id: 'session-123',
            userId: 'user-123',
            transcriptRaw: [{ speaker: 'User', text: 'I remember my grandmother used to bake apple pies.' }]
        });

        (mockChapterGenerator.generateChapter as any).mockResolvedValue({
            chapter: 'Title: My Grandmother\'s Kitchen\n\n' + 'Generated content must be long enough to pass validation rules. '.repeat(5),
            atoms: { narrativeArc: 'Memory of grandmother', emotionalValence: 'nostalgic' }
        });

        (mockChapterRepository.findBySessionId as any).mockResolvedValue([]);
        (mockChapterRepository.findByUserId as any).mockResolvedValue([]);

        // @ts-ignore - injecting memory port even if constructor doesn't match yet (JS allows it, TS checks compile time)
        useCase = new GenerateChapterUseCase(
            mockChapterRepository,
            mockSessionRepository,
            mockUserRepository,
            mockChapterGenerator,
            mockEmailService,
            mockLLM,
            mockStorybookGenerator,
            // Inject Factory Function
            (userId: string) => mockAgentMemory
        );
    });

    it('should query episodic memory for relevant context', async () => {
        // Arrange
        const transcript = "I remember my grandmother used to bake apple pies.";
        (mockAgentMemory.query as any).mockResolvedValue([{
            id: 'mem-1',
            content: 'Grandmother had a secret apple pie recipe from 1950.',
            type: MemoryType.EPISODIC,
            importance: MemoryImportance.HIGH,
            tags: ['family', 'food']
        }]);

        // Act
        await useCase.execute('session-123');

        // Assert
        // Verify memory query
        expect(mockAgentMemory.query).toHaveBeenCalledWith(expect.objectContaining({
            query: expect.stringMatching(/grandmother|apple pie|bake/i),
            types: expect.arrayContaining([MemoryType.EPISODIC]),
        }));

        // Verify Context Injection into Chapter Generator
        expect(mockChapterGenerator.generateChapter).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            expect.objectContaining({
                memories: expect.arrayContaining([expect.stringContaining('Grandmother had a secret')]),
                isDayZero: true
            })
        );

        // Verify Context Injection into Storybook Generator
        // Wait, storybook is async and fire-and-forget. We need to wait or rely on mock checks being sync if it was called synchronously.
        // It is called in a `.catch()` block but the call itself is synchronous initiation of promise.
        expect(mockStorybookGenerator.generateStorybook).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                visualThemes: expect.any(Array),
                characterName: expect.any(String) // 'The Protagonist' or from user seed if we mocked user repo with specific data
            })
        );
    });
});
