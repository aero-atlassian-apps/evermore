import { ChapterRepository } from '../../domain/repositories/ChapterRepository';
import { SessionRepository } from '../../domain/repositories/SessionRepository';
import { EmailServicePort } from '../ports/EmailServicePort';
import { Chapter } from '../../domain/entities/Chapter';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { ChapterGeneratorPort } from '../ports/ChapterGeneratorPort';
import { LLMPort } from '../ports/LLMPort';
import { HallucinationDetector } from '../safety/HallucinationDetector';
import { logger } from '../Logger';
import { randomUUID } from 'crypto';
import { StorybookGeneratorPort } from '../ports/StorybookGeneratorPort';
import { AgentMemoryPort } from '../ports/AgentMemoryPort';
import { MemoryType } from '../agent/memory/AgentMemory';

type AgentMemoryFactory = (userId: string) => AgentMemoryPort;

export interface ChapterGenerationResult {
  chapterId: string;
  hallucinationCheck?: {
    passed: boolean;
    risk: 'low' | 'medium' | 'high';
    flaggedCount: number;
  };
}

export class GenerateChapterUseCase {
  private hallucinationDetector: HallucinationDetector;

  constructor(
    private chapterRepository: ChapterRepository,
    private sessionRepository: SessionRepository,
    private userRepository: UserRepository,
    private chapterGenerator: ChapterGeneratorPort,
    private emailService: EmailServicePort,
    private llm: LLMPort,
    private storybookGenerator: StorybookGeneratorPort,
    private agentMemoryFactory: AgentMemoryFactory
  ) {
    // Initialize hallucination detector with injected LLM
    this.hallucinationDetector = new HallucinationDetector(llm, {
      flagThreshold: 0.7,
      suggestCorrections: true,
    });
  }

  async execute(sessionId: string): Promise<string> {
    const result = await this.executeWithValidation(sessionId);
    return result.chapterId;
  }

  /**
   * Execute with full validation and hallucination checking.
   */
  async executeWithValidation(sessionId: string): Promise<ChapterGenerationResult> {
    logger.info('[GenerateChapter] Starting chapter generation', { sessionId });

    // 1. Validate session exists
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      logger.error('[GenerateChapter] Session not found', { sessionId });
      throw new Error(`Session not found: ${sessionId}`);
    }

    // 2. Check for duplicate processing (idempotency guard)
    const existingChapters = await this.chapterRepository.findBySessionId(sessionId);
    if (existingChapters && existingChapters.length > 0) {
      logger.warn('[GenerateChapter] Session already has a chapter, skipping generation', {
        sessionId,
        existingChapterId: existingChapters[0].id
      });
      return {
        chapterId: existingChapters[0].id,
        hallucinationCheck: undefined,
      };
    }

    // Parse transcript
    let transcript: any[] = [];
    try {
      const raw = session.transcriptRaw;
      if (!raw) {
        transcript = [];
      } else if (Array.isArray(raw)) {
        transcript = raw;
      } else if (typeof raw === 'object') {
        transcript = Array.isArray((raw as any).messages) ? (raw as any).messages : [];
      } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        transcript = trimmed ? JSON.parse(trimmed) : [];
      }
    } catch (e) {
      console.warn(`[GenerateChapter] Failed to parse transcript for session ${sessionId}`);
      transcript = [];
    }

    if (!Array.isArray(transcript) || transcript.length === 0) {
      throw new Error(`Cannot generate chapter: Session ${sessionId} has no transcript content.`);
    }

    const transcriptText = transcript.map((m: any) => `${m.speaker || 'unknown'}: ${m.text || ''}`).join('\n');

    if (transcriptText.trim().length < 50) {
      throw new Error(`Cannot generate chapter: Session ${sessionId} has insufficient transcript content.`);
    }

    // Fetch previous chapters for context
    const previousChapters = await this.chapterRepository.findByUserId(session.userId);

    // ============================================================================
    // DEEP MEMORY CONTEXT - Validate & Extract Atoms
    // ============================================================================
    const deepContext: any = {
      isDayZero: previousChapters.length === 0,
      knownThemes: [],
      cumulativeEmotionalState: 'neutral',
      memories: []
    };

    // Instantiate Memory Agent for this user
    const memoryAgent = this.agentMemoryFactory(session.userId);

    try {
      const memoryResults = await memoryAgent.query({
        query: transcriptText.substring(0, 300),
        types: [MemoryType.EPISODIC, MemoryType.SEMANTIC, MemoryType.LONG_TERM],
        limit: 3,
        minImportance: 2
      });
      deepContext.memories = memoryResults.map(m => m.content);
      logger.info('[GenerateChapter] Retrieved memories', { count: memoryResults.length, sessionId });
    } catch (err) {
      logger.warn('[GenerateChapter] Failed to retrieve memories', { error: err });
    }

    if (previousChapters.length > 0) {
      deepContext.knownThemes = previousChapters
        .map(c => c.metadata?.atoms?.narrativeArc)
        .filter(Boolean);

      if (previousChapters[0].metadata?.emotionalTone) {
        deepContext.cumulativeEmotionalState = previousChapters[0].metadata.emotionalTone;
      }
    }

    // ALWAYS Fetch User Profile for identity grounding
    try {
      const user = await this.userRepository.findById(session.userId);
      if (user) {
        const rawPrefs = user.preferences || {};
        const userSeed: any = {
          name: user.name,
          gender: rawPrefs.gender,
          birthYear: rawPrefs.birthYear,
          location: rawPrefs.location,
          formerOccupation: rawPrefs.formerOccupation,
          aboutMe: rawPrefs.aboutMe,
          spouseName: rawPrefs.spouseName,
          childrenCount: rawPrefs.childrenCount,
          grandchildrenCount: rawPrefs.grandchildrenCount,
          topicsLove: rawPrefs.topicsLove,
          topicsAvoid: rawPrefs.topicsAvoid,
          favoriteDecade: rawPrefs.favoriteDecade,
        };

        const cleanObj = (obj: any): any => {
          if (!obj || typeof obj !== 'object') return obj;
          const res: any = {};
          let hasKeys = false;
          Object.keys(obj).forEach(key => {
            const val = obj[key];
            if (val !== null && val !== undefined && val !== '') {
              if (Array.isArray(val)) {
                if (val.length > 0) {
                  res[key] = val;
                  hasKeys = true;
                }
              } else {
                res[key] = val;
                hasKeys = true;
              }
            }
          });
          return hasKeys ? res : undefined;
        };

        deepContext.userSeed = cleanObj(userSeed);
        if (deepContext.userSeed) {
          logger.info('[GenerateChapter] Injected rich user profile context', { keys: Object.keys(deepContext.userSeed) });
        }
      }
    } catch (err) {
      logger.warn('[GenerateChapter] Failed to fetch user profile context', { error: err });
    }

    const previousSummaries = previousChapters.slice(0, 5).map(ch => ({
      title: ch.title,
      summary: ch.excerpt,
      atoms: ch.metadata?.atoms
    }));

    // Generate Chapter
    const { chapter: content, atoms } = await this.chapterGenerator.generateChapter(transcriptText, previousSummaries, deepContext);

    // Hallucination Detection
    let hallucinationResult: ChapterGenerationResult['hallucinationCheck'] = undefined;
    try {
      const validation = await this.hallucinationDetector.comprehensiveCheck(
        content,
        [{ id: 'session_transcript', type: 'transcript', content: transcriptText, confidence: 1 }],
        'chapter'
      );
      hallucinationResult = {
        passed: validation.overallRisk !== 'high',
        risk: validation.overallRisk,
        flaggedCount: validation.allFlagged.length,
      };
    } catch (error) {
      logger.error('Hallucination detection failed', { sessionId, error: (error as Error).message });
    }

    // Create Chapter Entity
    const requiresReview = hallucinationResult?.risk === 'high' || hallucinationResult?.risk === 'medium';
    const lines = content.trim().split('\n');
    let evocativeTitle = lines[0].trim()
      .replace(/^Chapter \d+[:\s]*/i, '')
      .replace(/^#+\s*/, '')
      .replace(/\*+/g, '')
      .trim();

    const bodyContent = lines.slice(1).join('\n').trim()
      .replace(/^#+\s*/gm, '')
      .replace(/\*+/g, '')
      .trim();

    if (evocativeTitle.length > 100 || evocativeTitle.length < 2) {
      evocativeTitle = atoms.narrativeArc.substring(0, 100);
    }

    const chapterNumber = previousChapters.length + 1;
    const chapter = new Chapter(
      randomUUID(),
      sessionId,
      session.userId,
      evocativeTitle,
      bodyContent,
      bodyContent.substring(0, 150) + '...',
      new Date(),
      undefined,
      undefined,
      undefined,
      [],
      {
        sessionNumber: chapterNumber,
        wordCount: bodyContent.split(' ').length,
        emotionalTone: atoms.emotionalValence,
        lifePeriod: "Unknown",
        atoms: atoms,
        requiresReview: requiresReview,
        reviewReason: requiresReview ? `Hallucination risk: ${hallucinationResult?.risk}` : undefined,
        ...(hallucinationResult && { hallucinationCheck: hallucinationResult }),
      }
    );

    chapter.validate();
    const createdChapter = await this.chapterRepository.create(chapter);

    // ============================================================================
    // PERSISTENCE TO MEMORY (Pinecone)
    // ============================================================================
    try {
      // 1. Store the core narrative arc as an episodic memory for future context
      await memoryAgent.store({
        type: MemoryType.EPISODIC,
        content: `The teller shared a story about: ${atoms.narrativeArc}. ${atoms.settingDescription || ''}`,
        importance: 4, // MemoryImportance.HIGH
        tags: [...(atoms.sensoryDetails || []), 'chapter-arc', atoms.emotionalValence].filter(Boolean),
        source: 'chapter-generator',
        relatedMemories: [],
        data: { chapterId: createdChapter.id, sessionId }
      });

      // 2. Store individual key moments if available
      if (atoms.keyMoments && Array.isArray(atoms.keyMoments)) {
        for (const moment of atoms.keyMoments) {
          await memoryAgent.store({
            type: MemoryType.EPISODIC,
            content: `Key Moment: ${moment.description || moment}`,
            importance: 3, // MemoryImportance.MEDIUM
            tags: ['key-moment', atoms.emotionalValence],
            source: 'chapter-generator',
            relatedMemories: [],
            data: { chapterId: createdChapter.id }
          });
        }
      }

      logger.info('[GenerateChapter] Persisted chapter atoms to long-term memory', {
        chapterId: createdChapter.id,
        atomsCount: (atoms.keyMoments?.length || 0) + 1
      });
    } catch (err) {
      logger.error('[GenerateChapter] Failed to persist chapter memories', { error: err });
    }

    // Notification & Post-processing
    try {
      const user = await this.userRepository.findById(session.userId);
      if (user) {
        await this.emailService.sendChapterNotification(createdChapter.id, user.email);
      }
    } catch (err) {
      logger.warn('[GenerateChapter] Failed to send notification', { error: err });
    }

    // Trigger Audio Generation (Async)
    try {
      const { GenerateChapterAudioUseCase } = await import('./GenerateChapterAudioUseCase');
      const { speechProvider, chapterRepository } = await import('@/lib/infrastructure/di/container');
      const audioGenerator = new GenerateChapterAudioUseCase(speechProvider, chapterRepository, this.userRepository);
      // Fire and forget - don't block response
      audioGenerator.execute(createdChapter.id).catch(err => {
        logger.error('[GenerateChapter] Async audio generation failed', { error: err.message });
      });
    } catch (error) {
      logger.error('[GenerateChapter] Failed to trigger audio generation', { error: (error as any).message });
    }

    // Trigger Image Generation (Async)
    try {
      const { AgenticChapterImageGenerator } = await import('../services/AgenticChapterImageGenerator');
      const { imageGenerator } = await import('@/lib/infrastructure/di/container');
      const imageGen = new AgenticChapterImageGenerator(this.llm, imageGenerator);
      const imageAtoms = {
        narrativeArc: atoms.narrativeArc,
        keyMoments: atoms.keyMoments,
        sensoryDetails: atoms.sensoryDetails,
        emotionalValence: atoms.emotionalValence,
        settingDescription: atoms.settingDescription
      };

      // Pass RICH context to image generator
      imageGen.generateChapterImages(bodyContent, imageAtoms, deepContext.userSeed)
        .then(async (result) => {
          if (result.success && (result.coverImageUrl || result.bannerImageUrl)) {
            await this.chapterRepository.update(createdChapter.id, {
              coverImageUrl: result.coverImageUrl,
              bannerImageUrl: result.bannerImageUrl
            });
          }
        }).catch(err => {
          logger.error('[GenerateChapter] Async image generation failed', { error: err.message });
        });
    } catch (error) {
      logger.error('[GenerateChapter] Failed to trigger image generation', { error: (error as any).message });
    }

    // Trigger Storybook Generation (Async)
    try {
      const userSeed = deepContext.userSeed || {};
      const descriptionParts: string[] = [];
      if (userSeed.gender) descriptionParts.push(`${userSeed.gender === 'male' ? 'A man' : userSeed.gender === 'female' ? 'A woman' : 'A person'}`);
      if (userSeed.birthYear) {
        const age = new Date().getFullYear() - userSeed.birthYear;
        descriptionParts.push(`aged ${age}`);
      }
      if (userSeed.location) descriptionParts.push(`from ${userSeed.location}`);
      if (userSeed.formerOccupation) descriptionParts.push(`formerly a ${userSeed.formerOccupation}`);
      if (userSeed.aboutMe) descriptionParts.push(`. ${userSeed.aboutMe}`);

      const familyContext: string[] = [];
      if (userSeed.spouseName) familyContext.push(`spouse named ${userSeed.spouseName}`);
      if (userSeed.childrenCount) familyContext.push(`${userSeed.childrenCount} children`);
      if (userSeed.grandchildrenCount) familyContext.push(`${userSeed.grandchildrenCount} grandchildren`);

      const characterDescription = descriptionParts.length > 0
        ? descriptionParts.join(' ') + (familyContext.length > 0 ? `. Has ${familyContext.join(', ')}.` : '')
        : 'An elderly storyteller sharing their memories.';

      const storybookContext = {
        characterName: userSeed.name || 'The Protagonist',
        characterDescription,
        characterGender: userSeed.gender || 'unknown',
        visualThemes: atoms.sensoryDetails || [],
        timePeriod: userSeed.favoriteDecade || 'Timeless',
        location: userSeed.location,
      };

      this.storybookGenerator.generateStorybook(createdChapter.id, storybookContext).catch(err => {
        logger.error('[GenerateChapter] Async storybook generation failed', { error: err.message });
      });
    } catch (error) {
      logger.error('[GenerateChapter] Failed to trigger storybook generation', { error: (error as any).message });
    }

    return {
      chapterId: createdChapter.id,
      hallucinationCheck: hallucinationResult,
    };
  }
}
