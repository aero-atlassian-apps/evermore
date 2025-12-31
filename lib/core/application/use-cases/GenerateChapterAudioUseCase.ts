import { SpeechPort } from '../ports/SpeechPort';
import { ChapterRepository } from '../../domain/repositories/ChapterRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { narrationAgent } from '@/lib/infrastructure/di/container';

// Logger utility
const logger = {
    info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
    error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
};

interface ChapterAudioResult {
    chapterId: string;
    audioUrl?: string;
    audioDuration?: number;
    error?: string;
}

/**
 * GenerateChapterAudioUseCase - Generates TTS narration for story chapters
 * 
 * Features:
 * - Splits long chapters into segments for better TTS quality
 * - Stores audio URL in chapter metadata
 * - Handles TTS failures gracefully
 */
export class GenerateChapterAudioUseCase {
    private speechProvider: SpeechPort;
    private chapterRepository: ChapterRepository;
    private userRepository: UserRepository;

    // Max characters per TTS request (ElevenLabs has limits)
    private readonly MAX_SEGMENT_CHARS = 4000;

    constructor(speechProvider: SpeechPort, chapterRepository: ChapterRepository, userRepository: UserRepository) {
        this.speechProvider = speechProvider;
        this.chapterRepository = chapterRepository;
        this.userRepository = userRepository;
    }

    /**
     * Generate audio narration for a chapter
     */
    async execute(chapterId: string): Promise<ChapterAudioResult> {
        try {
            logger.info(`[ChapterAudio] Starting audio generation for chapter ${chapterId}`);

            // Fetch the chapter
            const chapter = await this.chapterRepository.findById(chapterId);
            if (!chapter) {
                throw new Error(`Chapter not found: ${chapterId}`);
            }

            // Check if audio already exists
            if (chapter.audioHighlightUrl) {
                logger.info(`[ChapterAudio] Audio already exists for chapter ${chapterId}`);
                return {
                    chapterId,
                    audioUrl: chapter.audioHighlightUrl,
                    audioDuration: chapter.audioDuration,
                };
            }



            // Fetch user profile for voice biasing
            const user = await this.userRepository.findById(chapter.userId);
            const userContext = user ? {
                gender: user.email.includes('mom') ? 'female' : 'male', // MVP fallback logic, should use user.profile
                age: 'adult', // Should come from profile
                name: user.name
            } : undefined;

            // 1. Agentic Preparation
            logger.info('[ChapterAudio] Agentic Flow: Preparing text for Audio...');
            const { preparedText, voiceStyle, emotion } = await narrationAgent.prepareNarration(chapter.content, {
                context: userContext
            });
            logger.info(`[ChapterAudio] Agentic Prep: ${preparedText.length} chars, Emotion: ${emotion}, Voice: ${voiceStyle}`);

            // Select voice
            const voiceId = narrationAgent.selectVoice(emotion, voiceStyle);

            // Split content into segments if too long (use preparedText)
            const segments = this.splitIntoSegments(preparedText);
            logger.info(`[ChapterAudio] Split into ${segments.length} segments`);

            // Generate audio for each segment
            const audioBuffers: Buffer[] = [];
            for (let i = 0; i < segments.length; i++) {
                try {
                    logger.info(`[ChapterAudio] Generating segment ${i + 1}/${segments.length}`);
                    const buffer = await this.speechProvider.textToSpeech(segments[i], {
                        style: voiceStyle,
                        voiceId: voiceId
                    } as any);
                    audioBuffers.push(buffer);
                } catch (segmentError) {
                    logger.error(`[ChapterAudio] Segment ${i + 1} failed:`, { error: segmentError });
                }
            }

            if (audioBuffers.length === 0) {
                throw new Error('All audio segments failed to generate');
            }

            // Combine all audio buffers
            const combinedAudio = Buffer.concat(audioBuffers);

            // Estimate duration (rough: 150 words per minute, ~5 chars per word)
            const wordCount = chapter.content.split(/\s+/).length;
            const estimatedDuration = Math.ceil((wordCount / 150) * 60);

            // For MVP: Store as base64 data URL (in production, upload to cloud storage)
            const audioDataUrl = `data:audio/mpeg;base64,${combinedAudio.toString('base64')}`;

            // Update chapter with audio info
            await this.chapterRepository.update(chapterId, {
                audioHighlightUrl: audioDataUrl,
                audioDuration: estimatedDuration,
            });

            logger.info(`[ChapterAudio] Successfully generated audio for chapter ${chapterId}`, {
                duration: estimatedDuration,
                segments: audioBuffers.length,
            });

            return {
                chapterId,
                audioUrl: audioDataUrl,
                audioDuration: estimatedDuration,
            };

        } catch (error: any) {
            logger.error(`[ChapterAudio] Failed to generate audio for chapter ${chapterId}:`, { error: error.message });
            return {
                chapterId,
                error: error.message,
            };
        }
    }

    /**
     * Split text into manageable segments for TTS
     */
    private splitIntoSegments(text: string): string[] {
        if (text.length <= this.MAX_SEGMENT_CHARS) {
            return [text];
        }

        const segments: string[] = [];
        const sentences = text.split(/(?<=[.!?])\s+/);
        let currentSegment = '';

        for (const sentence of sentences) {
            if ((currentSegment + ' ' + sentence).length > this.MAX_SEGMENT_CHARS) {
                if (currentSegment) {
                    segments.push(currentSegment.trim());
                }
                currentSegment = sentence;
            } else {
                currentSegment = currentSegment ? currentSegment + ' ' + sentence : sentence;
            }
        }

        if (currentSegment) {
            segments.push(currentSegment.trim());
        }

        return segments;
    }
}
