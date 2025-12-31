/**
 * Agentic Chapter Image Generator
 * 
 * Orchestrates context-aware image generation for story chapters.
 * Part of the agentic AI system with proper error handling and fallbacks.
 * 
 * @module AgenticChapterImageGenerator
 */

import { LLMPort } from '../ports/LLMPort';
import { ImageGenerationPort, GeneratedImage } from '../ports/ImageGenerationPort';
import { logger } from '../Logger';

// ============================================================================
// Types
// ============================================================================

export interface StoryAtoms {
    narrativeArc: string;
    keyMoments?: Array<{ description: string; emotionalWeight?: number }>;
    sensoryDetails?: string[];
    emotionalValence?: string;
    settingDescription?: string;
}

export interface ChapterImagePrompts {
    cardPrompt: string;
    bannerPrompt: string;
}

export interface GeneratedChapterImages {
    coverImageUrl?: string;  // Data URI or undefined if failed
    bannerImageUrl?: string; // Data URI or undefined if failed
    promptsUsed: ChapterImagePrompts;
    success: boolean;
    error?: string;
}

// ============================================================================
// Agentic Image Generator
// ============================================================================

/**
 * AgenticChapterImageGenerator - AI-orchestrated image generation for story chapters.
 * 
 * This service is part of the agentic AI system and follows the same patterns:
 * - Context-aware prompt generation using LLM
 * - Graceful degradation on failures
 * - Non-blocking async execution
 * - Proper logging and observability
 * 
 * Usage:
 * ```typescript
 * const generator = new AgenticChapterImageGenerator(llm, imageGenerator);
 * const images = await generator.generateChapterImages(chapterContent, atoms, 'John');
 * if (images.success) {
 *   chapter.setCoverImages(images.coverImageUrl!, images.bannerImageUrl);
 * }
 * ```
 */
export class AgenticChapterImageGenerator {
    constructor(
        private llm: LLMPort,
        private imageGenerator: ImageGenerationPort
    ) { }

    /**
     * Generate both card and banner images for a chapter.
     * Uses LLM to craft context-aware prompts based on story content.
     */
    async generateChapterImages(
        chapterContent: string,
        atoms: StoryAtoms,
        userSeed?: any
    ): Promise<GeneratedChapterImages> {
        const startTime = Date.now();

        try {
            // Step 1: Generate context-aware prompts using LLM
            logger.info('[AgenticChapterImageGenerator] Generating image prompts', {
                narrativeArc: atoms.narrativeArc,
                hasUserSeed: !!userSeed,
                hasSensoryDetails: !!atoms.sensoryDetails?.length
            });

            const prompts = await this.generateImagePrompts(chapterContent, atoms, userSeed);

            // Step 2: Generate both images in parallel for efficiency
            logger.info('[AgenticChapterImageGenerator] Generating images', {
                cardPromptLength: prompts.cardPrompt.length,
                bannerPromptLength: prompts.bannerPrompt.length
            });

            const [coverResult, bannerResult] = await Promise.allSettled([
                this.generateSingleImage(prompts.cardPrompt, 'card'),
                this.generateSingleImage(prompts.bannerPrompt, 'banner')
            ]);

            // ... rest of the method ...
            const coverImage = coverResult.status === 'fulfilled' ? coverResult.value : undefined;
            const bannerImage = bannerResult.status === 'fulfilled' ? bannerResult.value : undefined;

            const durationMs = Date.now() - startTime;
            logger.info('[AgenticChapterImageGenerator] Image generation complete', {
                coverSuccess: !!coverImage,
                bannerSuccess: !!bannerImage,
                durationMs
            });

            return {
                coverImageUrl: coverImage ? this.toDataUri(coverImage) : undefined,
                bannerImageUrl: bannerImage ? this.toDataUri(bannerImage) : undefined,
                promptsUsed: prompts,
                success: !!(coverImage || bannerImage), // Success if at least one image generated
                error: (!coverImage && !bannerImage)
                    ? 'Both image generations failed'
                    : undefined
            };

        } catch (error: any) {
            logger.error('[AgenticChapterImageGenerator] Fatal error', {
                error: error.message,
                durationMs: Date.now() - startTime
            });

            return {
                coverImageUrl: undefined,
                bannerImageUrl: undefined,
                promptsUsed: { cardPrompt: '', bannerPrompt: '' },
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate context-aware image prompts using LLM.
     * This is the "brain" that understands the story and crafts visual descriptions.
     */
    private async generateImagePrompts(
        chapterContent: string,
        atoms: StoryAtoms,
        userSeed?: any
    ): Promise<ChapterImagePrompts> {
        // Extract meaningful excerpt (first 500 chars for context)
        const contentExcerpt = chapterContent.substring(0, 500);

        // Build rich identity description from user profile
        const identityParts: string[] = [];
        if (userSeed?.name) identityParts.push(`Character Name: ${userSeed.name}`);
        if (userSeed?.gender) identityParts.push(`Gender: ${userSeed.gender}`);
        if (userSeed?.birthYear) {
            const age = new Date().getFullYear() - userSeed.birthYear;
            identityParts.push(`Approximate Age: ${age}`);
        }
        if (userSeed?.location) identityParts.push(`Location: ${userSeed.location}`);
        if (userSeed?.formerOccupation) identityParts.push(`Background/Occupation: ${userSeed.formerOccupation}`);
        if (userSeed?.aboutMe) identityParts.push(`Bio/Personality: ${userSeed.aboutMe}`);

        const identityContext = identityParts.length > 0
            ? identityParts.join('\n')
            : "Character: An elderly person reflecting on their memories";

        // Build atmosphere from story atoms
        const keyMomentDescription = atoms.keyMoments?.[0]?.description || 'A meaningful moment from life';
        const sensoryContext = atoms.sensoryDetails?.slice(0, 5).join(', ') || 'warm lighting, nostalgic atmosphere';
        const emotionalTone = atoms.emotionalValence || 'warm and reflective';
        const setting = atoms.settingDescription || 'a place filled with memories';

        const prompt = `You are a world-class visual prompt engineer specializing in biographical storytelling illustrations.

STORY IDENTITY & CHARACTER:
${identityContext}

STORY CONTEXT:
Title: "${atoms.narrativeArc}"
Emotional Tone: ${emotionalTone}
Key Moment: ${keyMomentDescription}
Sensory Details: ${sensoryContext}
Setting: ${setting}

STORY EXCERPT:
"${contentExcerpt}..."

YOUR TASK: Generate TWO image prompts that capture the ESSENCE and EMOTION of this biographical story.
CRITICAL: The visual character MUST accurately reflect the identity details provided above (gender, age, background).

IMAGE PROMPT GUIDELINES:
1. CARD IMAGE (4:3 ratio):
   - Intimate, close-up or medium shot
   - Focus on emotional connection and warmth
   - Should work well as a thumbnail
   - Include specific visual elements from the story

2. BANNER IMAGE (16:9 ratio):
   - Wider establishing shot showing environment/context
   - More atmospheric and immersive
   - Sets the scene and era of the memory
   - Should work as a page header

STYLE REQUIREMENTS:
- Warm, nostalgic children's book illustration style
- Soft watercolor or gouache aesthetic
- Family-friendly, heartwarming
- NO text, NO speech bubbles, NO words
- Gentle lighting with warm color palette
- Evokes the feeling of treasured memories

OUTPUT: JSON with exactly this structure:
{
  "cardPrompt": "Detailed prompt for the card thumbnail...",
  "bannerPrompt": "Detailed prompt for the banner image..."
}

Make the prompts SPECIFIC to this story and character. Include concrete visual details.`;

        try {
            const result = await this.llm.generateJson<ChapterImagePrompts>(prompt);

            // Validate response structure
            if (!result.cardPrompt || !result.bannerPrompt) {
                throw new Error('Invalid prompt structure from LLM');
            }

            return result;
        } catch (error: any) {
            // Fallback: Generate basic prompts from identity and atoms
            logger.warn('[AgenticChapterImageGenerator] LLM prompt generation failed, using fallback', {
                error: error.message
            });

            const fallbackRef = userSeed?.name || (userSeed?.gender === 'male' ? 'an elderly man' : userSeed?.gender === 'female' ? 'an elderly woman' : 'an elderly person');

            return {
                cardPrompt: `Warm nostalgic illustration of ${fallbackRef} during "${atoms.narrativeArc}". ${sensoryContext}. Soft watercolor style, heartwarming family scene, no text.`,
                bannerPrompt: `Wide panoramic view of ${setting} from the era of "${atoms.narrativeArc}". Nostalgic atmosphere with ${sensoryContext}. Soft lighting, warm colors, children's book illustration style, no text.`
            };
        }
    }

    /**
     * Generate a single image with error handling.
     */
    private async generateSingleImage(prompt: string, type: 'card' | 'banner'): Promise<GeneratedImage> {
        try {
            const image = await this.imageGenerator.generateImage(prompt, {
                style: 'storybook',
                safetyLevel: 'strict'
            });

            // Verify we got actual image data
            if (!image.base64 || image.base64.length < 100) {
                throw new Error('Generated image is empty or too small');
            }

            return image;
        } catch (error: any) {
            logger.error(`[AgenticChapterImageGenerator] ${type} image generation failed`, {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Convert GeneratedImage to data URI for storage.
     */
    private toDataUri(image: GeneratedImage): string {
        return `data:${image.mimeType};base64,${image.base64}`;
    }
}
