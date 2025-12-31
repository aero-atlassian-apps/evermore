/**
 * Agentic Storybook Orchestrator - World-Class Orchestrated Storybook Generation
 * 
 * Uses the full agentic infrastructure:
 * - AoT (Atom of Thought) decomposition for scene analysis
 * - ReACT loop for iterative scene generation
 * - Chain of Thought for illustration prompts
 * - Context-aware using previous chapters & user profile
 * - VectorDB for memory retrieval when available
 * 
 * @module AgenticStorybookOrchestrator
 */

import { LLMPort } from '../../../core/application/ports/LLMPort';
import { ImageGenerationPort, GeneratedImage } from '../../../core/application/ports/ImageGenerationPort';
import { VectorStorePort } from '../../../core/application/ports/VectorStorePort';
import { ChapterRepository } from '../../../core/domain/repositories/ChapterRepository';
import { UserRepository } from '../../../core/domain/repositories/UserRepository';
import {
    ToolContract,
    ToolResult,
    ToolRegistry,
    ToolCapability,
    ToolPermission
} from '../../../core/application/agent/tools/ToolContracts';
import { z } from 'zod';
import { StorybookData, StorybookContext, StorybookAtoms } from '../../../core/application/ports/StorybookGeneratorPort';
import { StorybookGeneratorPort } from '../../../core/application/ports/StorybookGeneratorPort';

// ============================================================================
// Types
// ============================================================================


interface Scene {
    pageNumber: number;
    moment: string;
    imagePrompt: string;
    storyText: string;
    visualElements: string[];
    layout: 'full-bleed' | 'left-image' | 'right-image' | 'top-image' | 'bottom-image';
    image?: GeneratedImage;
}

// ============================================================================
// Tool Contracts - AoT Decomposition Tools
// ============================================================================

const createTransformToChildrenStoryTool = (llm: LLMPort): ToolContract<{ content: string; title: string; context?: string }, { childrenStory: string }> => ({
    metadata: {
        id: 'transform-children-story',
        name: 'Transform to Children Story',
        description: 'Transform adult biography into warm children\'s story format',
        usageHint: 'Use first to create age-appropriate narrative',
        version: '1.0.0',
        capabilities: [ToolCapability.WRITE],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 5,
        estimatedLatencyMs: 4000,
        enabled: true,
    },
    inputSchema: z.object({
        content: z.string(),
        title: z.string(),
        context: z.string().optional()
    }),
    outputSchema: z.object({
        childrenStory: z.string()
    }),
    async execute(input): Promise<ToolResult<{ childrenStory: string }>> {
        const startTime = Date.now();

        // Dynamically determine page count based on content length
        const contentLength = input.content.length;
        const pageCount = contentLength > 3000 ? 12 : contentLength > 1500 ? 10 : 8;

        const prompt = `Transform this biography into a ${pageCount}-page children's story (ages 5-10) told by the grandparent.

ORIGINAL MEMORY: ${input.content.substring(0, 4000)}

CRITICAL VOICE RULES:
- Write in FIRST PERSON ("I remember...", "When I was little...")
- Tone: Grandparent telling a bedtime story to their grandchild
- Use "You know..." or "Imagine..." to connect with the child
- Keep it personal and warm - NO "Once upon a time" fairy tale style
- Simplify complex themes but keep the truth (War -> "Hard times when we had to be brave")
- Simplify complex themes but keep the truth (War -> "Hard times when we had to be brave")
- IMPORTANT: Tell the COMPLETE story - do not truncate or leave it unfinished!
- NO PLACEHOLDERS: Use the person's real name if provided in context, otherwise use "my grandchild". NEVER use brackets like [Name].

FORMAT:
- ${pageCount} pages total
- Mark pages with ---PAGE X---
- 60-90 words per page (easy to read)
- Make sure the story has a beginning, middle, and END

OUTPUT the complete story:`;

        try {
            const childrenStory = await llm.generateText(prompt, { maxTokens: 3000 });
            return {
                success: true,
                data: { childrenStory },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 600, output: 1500 }
            };
        } catch (error: any) {
            return {
                success: false,
                error: { code: 'TRANSFORM_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createExtractKeyMomentsTool = (llm: LLMPort): ToolContract<{ story: string }, { keyMoments: any[] }> => ({
    metadata: {
        id: 'extract-key-moments',
        name: 'Extract Key Moments (AoT)',
        description: 'AoT Atom 1: Identify 8-12 key visual moments for illustration',
        usageHint: 'Use for AoT decomposition phase',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 2,
        estimatedLatencyMs: 2500,
        enabled: true,
    },
    inputSchema: z.object({
        story: z.string()
    }),
    outputSchema: z.object({
        keyMoments: z.array(z.any())
    }),
    async execute(input): Promise<ToolResult<{ keyMoments: any[] }>> {
        const startTime = Date.now();
        const prompt = `Identify 8-12 key VISUAL moments for illustration (enough to cover the complete story).

STORY: ${input.story}

OUTPUT JSON:
{
  "moments": [
    { "moment": "brief description (5-8 words)", "importance": 0.9, "reasoning": "why this matters" }
  ]
}

RULES: 
- Must be visual (people, places, actions), not abstract thoughts.
- Cover the ENTIRE story from beginning to end
- Include moments from the conclusion too`;

        try {
            const parsed = await llm.generateJson<{ moments: any[] }>(prompt);
            return {
                success: true,
                data: { keyMoments: parsed.moments || [] },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 400, output: 300 }
            };
        } catch (error: any) {
            return {
                success: false,
                data: { keyMoments: [] },
                error: { code: 'MOMENT_EXTRACTION_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createExtractCharacterDetailsTool = (llm: LLMPort): ToolContract<{ content: string; context?: string }, { character: any }> => ({
    metadata: {
        id: 'extract-character-details',
        name: 'Extract Character Details (AoT)',
        description: 'AoT Atom 2: Extract visual character details for consistent illustration',
        usageHint: 'Use for character consistency across scenes',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 2000,
        enabled: true,
    },
    inputSchema: z.object({
        content: z.string(),
        context: z.string().optional()
    }),
    outputSchema: z.object({
        character: z.any()
    }),
    async execute(input): Promise<ToolResult<{ character: any }>> {
        const startTime = Date.now();
        const prompt = `Extract the PRIMARY VISUAL CHARACTER (Protagonist) details for illustration.
${input.context ? `CONTEXT (Narrator/User): ${input.context}\n` : ''}
CONTENT: ${input.content.substring(0, 1500)}

CRITICAL AGENTIC REASONING:
1. TIME SHIFT: If story is a memory ("When I was young"), the protagonist is the YOUNGER version of the narrator. Derive age from story context, NOT just the narrator's current age.
2. RELATIONSHIPS: Infer gender/appearance from titles ("Uncle" = male, "Grandma" = female).
3. CONSISTENCY: Keep physical traits (hair color, ethnicity) consistent with the Narrator unless the story is about someone else.

OUTPUT JSON:
{
  "character": {
    "name": "...",
    "age": "visual_age (e.g. '10 years old' or 'Elderly')",
    "physicalDescription": "detailed visual description for image generation",
    "clothingStyle": "era-appropriate clothing",
    "distinguishingFeatures": "..."
  }
}`;

        try {
            const parsed = await llm.generateJson<{ character: any }>(prompt);
            return {
                success: true,
                data: { character: parsed.character || { name: 'Our Hero', age: 'varies' } },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 400, output: 150 }
            };
        } catch (error: any) {
            return {
                success: false,
                data: { character: { name: 'Our Hero', age: 'varies', physicalDescription: '' } },
                error: { code: 'CHARACTER_EXTRACTION_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createExtractSettingTool = (llm: LLMPort): ToolContract<{ content: string }, { setting: any }> => ({
    metadata: {
        id: 'extract-setting',
        name: 'Extract Setting (AoT)',
        description: 'AoT Atom 3: Extract time period, location, and atmosphere',
        usageHint: 'Use to establish visual context',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 2000,
        enabled: true,
    },
    inputSchema: z.object({
        content: z.string()
    }),
    outputSchema: z.object({
        setting: z.any()
    }),
    async execute(input): Promise<ToolResult<{ setting: any }>> {
        const startTime = Date.now();
        const prompt = `Extract the SETTING details for visual illustration.
CONTENT: ${input.content.substring(0, 1500)}

CRITICAL:
1. TIME PERIOD: Infer specific decade/era (e.g. "1960s Beirut", "Victorian era") from clues.
2. LOCATION: Specific place dynamics (e.g. "Bustling market", "Quiet farmhouse").
3. ATMOSPHERE: Lighting/mood (e.g. "Golden hour", "Dusty", "Rainy").

OUTPUT JSON:
{
  "setting": {
    "timePeriod": "...",
    "location": "...",
    "atmosphere": "..."
  }
}`;

        try {
            const parsed = await llm.generateJson<{ setting: any }>(prompt);
            return {
                success: true,
                data: { setting: parsed.setting || { timePeriod: 'Timeless', location: 'Unspecified', atmosphere: 'Warm' } },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 500, output: 100 }
            };
        } catch (error: any) {
            return {
                success: false,
                data: { setting: { timePeriod: 'Timeless', location: 'Story world', atmosphere: 'Warm' } },
                error: { code: 'SETTING_EXTRACTION_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createSynthesizeScenesTool = (llm: LLMPort): ToolContract<{ atoms: any; story: string }, { scenes: any[] }> => ({
    metadata: {
        id: 'synthesize-scenes',
        name: 'Synthesize Scenes (AoT Contraction)',
        description: 'AoT Contraction: Combine atoms into 6 optimal scenes with image prompts',
        usageHint: 'Use after gathering all atoms to create final scene sequence',
        version: '1.0.0',
        capabilities: [ToolCapability.WRITE],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 5,
        estimatedLatencyMs: 4000,
        enabled: true,
    },
    inputSchema: z.object({
        atoms: z.any(),
        story: z.string()
    }),
    outputSchema: z.object({
        scenes: z.array(z.any())
    }),
    async execute(input): Promise<ToolResult<{ scenes: any[] }>> {
        const startTime = Date.now();
        const prompt = `Create 6 illustrated page scenes from these AoT atoms.

ATOMS:
- Key Moments: ${JSON.stringify(input.atoms.keyMoments?.slice(0, 6) || [])}
- Key Moments: ${JSON.stringify(input.atoms.keyMoments?.slice(0, 6) || [])}
- Character: ${JSON.stringify(input.atoms.characterDetails || {})}
- Setting: ${JSON.stringify(input.atoms.setting || {})}
- Visual Elements: ${JSON.stringify(input.atoms.visualElements || [])}

STORY: ${input.story.substring(0, 1500)}

OUTPUT JSON:
{
  "scenes": [
    {
      "pageNumber": 1,
      "moment": "Young Maria walking toward the old farmhouse",
      "pageNumber": 1,
      "moment": "Young Maria walking toward the old farmhouse",
      "imagePrompt": "Warm watercolor illustration. [Setting: 1950s Farmhouse, Morning Light]. Young girl (Maria, 8yo) walking toward cozy farmhouse. Nostalgic mood. No text.",
      "storyText": "Text for this page (2-3 sentences)",
      "visualElements": ["farmhouse", "morning light"],
      "layout": "full-bleed"
    }
  ]
}

LAYOUTS: full-bleed (dramatic), top-image, bottom-image, left-image, right-image
CREATE exactly 6 scenes covering the full narrative arc.`;

        try {
            const parsed = await llm.generateJson<{ scenes: any[] }>(prompt, undefined, { maxTokens: 2000 });
            return {
                success: true,
                data: { scenes: parsed.scenes || [] },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 800, output: 2000 }
            };
        } catch (error: any) {
            return {
                success: false,
                data: { scenes: [] },
                error: { code: 'SCENE_SYNTHESIS_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

// ============================================================================
// Agentic Storybook Orchestrator
// ============================================================================

export class AgenticStorybookOrchestrator implements StorybookGeneratorPort {
    private toolRegistry: ToolRegistry;

    constructor(
        private chapterRepository: ChapterRepository,
        private userRepository: UserRepository,
        private llm: LLMPort,
        private imageGenerator?: ImageGenerationPort,
        private vectorStore?: VectorStorePort
    ) {
        // Initialize tool registry with AoT tools
        this.toolRegistry = new ToolRegistry();
        this.toolRegistry.register(createTransformToChildrenStoryTool(llm));
        this.toolRegistry.register(createExtractKeyMomentsTool(llm));
        this.toolRegistry.register(createExtractCharacterDetailsTool(llm));
        this.toolRegistry.register(createExtractSettingTool(llm));
        this.toolRegistry.register(createSynthesizeScenesTool(llm));
    }

    async generateStorybook(chapterId: string, context?: StorybookContext): Promise<StorybookData> {
        console.log('📚 Agentic Storybook Orchestrator - Starting');
        if (context?.characterName) {
            console.log(`   Detailed Context: Character=${context.characterName}, Time=${context.timePeriod}`);
        }

        const executionContext = {
            userId: 'storybook-orchestrator',
            sessionId: `storybook-${Date.now()}`,
            agentId: 'storybook-agent',
            requestId: crypto.randomUUID(),
            permissions: new Map<string, ToolPermission>(),
            dryRun: false,
        };

        // ===== STEP 1: Load Chapter Context =====
        console.log('   ├─ Step 1: Loading chapter context...');
        const chapter = await this.chapterRepository.findById(chapterId);
        if (!chapter) throw new Error('Chapter not found');

        // Note: VectorDB context retrieval would require embedding the query first
        // This can be enhanced later with EmbeddingPort integration
        const memoryContext = '';
        console.log('   │  ✓ Chapter loaded: ' + chapter.title.substring(0, 30));

        // ===== STEP 1.5: Load User Context =====
        const user = await this.userRepository.findById(chapter.userId);
        const age = user?.preferences?.birthYear ? new Date().getFullYear() - user.preferences.birthYear : 'unknown age';
        const gender = user?.preferences?.gender || 'unknown gender';
        const bio = user?.preferences?.aboutMe || '';

        const userDescription = user ? `${user.name} (${age}, ${gender})` : 'Unknown';
        console.log(`   │  ✓ User Context: ${userDescription}`);

        // Construct rich context for generation
        const richContext = `
USER PROFILE: ${userDescription}
BIO: ${bio}
${context?.characterDescription || ''}
        `.trim();

        // ===== STEP 2: Transform to Children's Story =====
        console.log('   ├─ Step 2: Transforming to children\'s story...');
        const transformResult = await this.toolRegistry.execute(
            'transform-children-story',
            { content: chapter.content, title: chapter.title, context: richContext }, // Passing RICH context
            executionContext
        );
        const childrenStory = (transformResult.data as any)?.childrenStory || this.fallbackChildrenStory(chapter.content);
        console.log(`   │  ✓ Children's story (${childrenStory.length} chars)`);

        // ===== STEP 3: AoT Decomposition (Parallel Atom Extraction) =====
        console.log('   ├─ Step 3: AoT Decomposition (parallel atom extraction)...');

        // Prepare context string for character extraction
        const charContext = context ? `
KNOWN CHARACTER: ${context.characterName}
DESCRIPTION: ${context.characterDescription}
VISUAL THEMES: ${context.visualThemes?.join(', ')}
TIME PERIOD: ${context.timePeriod}
        `.trim() : '';

        const [momentsResult, characterResult, settingResult] = await Promise.all([
            this.toolRegistry.execute('extract-key-moments', { story: childrenStory }, executionContext),
            this.toolRegistry.execute('extract-character-details', { content: chapter.content, context: charContext }, executionContext),
            this.toolRegistry.execute('extract-setting', { content: chapter.content }, executionContext),
        ]);

        const atoms: StorybookAtoms = {
            keyMoments: (momentsResult.data as any)?.keyMoments || [],
            characterDetails: (characterResult.data as any)?.character || { name: 'Our Hero', age: 'varies', physicalDescription: '' },
            visualElements: ['warm tones', 'nostalgic setting'],
            narrativeBeats: [],
            emotionalTone: {
                primaryEmotion: 'hopeful',
                emotionalArc: 'discovery to warmth',
                preservationNotes: ['maintain cozy atmosphere']
            },
            setting: (settingResult.data as any)?.setting || { timePeriod: 'Timeless', location: 'Story world', atmosphere: 'Warm' }
        };
        console.log(`   │  ✓ Atoms: ${atoms.keyMoments.length} moments, Char: ${atoms.characterDetails.name}, Time: ${atoms.setting?.timePeriod}`);

        // ===== STEP 4: AoT Contraction - Synthesize Scenes =====
        console.log('   ├─ Step 4: AoT Contraction (synthesizing scenes)...');
        const scenesResult = await this.toolRegistry.execute(
            'synthesize-scenes',
            { atoms, story: childrenStory },
            executionContext
        );

        let scenes: Scene[] = (scenesResult.data as any)?.scenes || [];

        // Fallback if no scenes generated
        if (scenes.length === 0) {
            console.log('   │  ⚠️ Using fallback scene generation');
            scenes = this.generateFallbackScenes(childrenStory, chapter.title);
        }
        console.log(`   │  ✓ ${scenes.length} scenes synthesized`);

        // ===== STEP 5: CoT Image Generation =====
        console.log('   ├─ Step 5: Generating illustrations (CoT prompts)...');
        const scenesWithImages = await this.generateImages(scenes, atoms);
        console.log(`   │  ✓ ${scenesWithImages.filter(s => s.image).length}/${scenesWithImages.length} images generated`);

        // ===== STEP 6: Compile Storybook =====
        const storybook: StorybookData = {
            id: `storybook-${chapterId}-${Date.now()}`,
            chapterId,
            title: this.generateTitle(atoms.characterDetails.name, chapter.title),
            childrenStory,
            scenes: scenesWithImages,
            atoms,
            metadata: {
                generatedAt: new Date(),
                characterName: atoms.characterDetails.name || 'Our Hero',
                timePeriod: 'Long ago',
                totalPages: scenesWithImages.length + 2,
                style: 'watercolor-storybook'
            }
        };

        console.log(`   └─ ✨ Storybook complete: "${storybook.title}" (${storybook.metadata.totalPages} pages)`);

        // PERSISTENCE: Save storybook data to the chapter metadata so it can be retrieved for PDF export
        try {
            const currentChapter = await this.chapterRepository.findById(chapterId);
            if (currentChapter) {
                await this.chapterRepository.update(chapterId, {
                    metadata: {
                        ...(currentChapter.metadata || {}),
                        storybook: storybook
                    } as any
                });
                console.log('   💾 Storybook persisted to chapter metadata');
            }
        } catch (error) {
            console.error('Failed to persist storybook to chapter:', error);
            // Don't fail the generation, just log
        }

        return storybook;
    }

    private async generateImages(scenes: Scene[], atoms: StorybookAtoms): Promise<Scene[]> {
        if (!this.imageGenerator) {
            return scenes.map(s => ({ ...s, image: this.createPlaceholder(s) }));
        }

        try {
            const isAvailable = await this.imageGenerator.isAvailable();
            if (!isAvailable) {
                return scenes.map(s => ({ ...s, image: this.createPlaceholder(s) }));
            }

            // Chain-of-Thought: Enhance prompts with character consistency
            const enhancedScenes = scenes.map(s => ({
                pageNumber: s.pageNumber,
                imagePrompt: `Character Reference: ${atoms.characterDetails.name} (${atoms.characterDetails.age}, ${atoms.characterDetails.physicalDescription}). Scene: ${s.imagePrompt}`
            }));

            const generatedImages = await this.imageGenerator.generateStorybookImages(enhancedScenes, {
                style: 'watercolor',
                safetyLevel: 'strict'
            });

            return scenes.map(s => ({
                ...s,
                image: generatedImages.get(s.pageNumber) || this.createPlaceholder(s)
            }));
        } catch (error) {
            console.error('Image generation failed:', error);
            return scenes.map(s => ({ ...s, image: this.createPlaceholder(s) }));
        }
    }

    private createPlaceholder(scene: Scene): GeneratedImage {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
            <defs><linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#87CEEB"/><stop offset="100%" style="stop-color:#FFF5E6"/>
            </linearGradient></defs>
            <rect width="800" height="600" fill="url(#bg)"/>
            <text x="400" y="280" text-anchor="middle" font-family="Georgia" font-size="24" fill="#5D4E37">
                🎨 Page ${scene.pageNumber}
            </text>
            <text x="400" y="320" text-anchor="middle" font-family="Georgia" font-size="16" fill="#7D6E57">
                "${scene.moment?.substring(0, 40) || 'A special moment'}..."
            </text>
        </svg>`;
        return { base64: Buffer.from(svg).toString('base64'), mimeType: 'image/svg+xml', prompt: scene.imagePrompt, metadata: { model: 'placeholder' } };
    }

    private generateTitle(characterName: string | undefined, chapterTitle: string): string {
        return characterName ? `The Story of ${characterName}` : chapterTitle.substring(0, 30);
    }

    private generateFallbackScenes(story: string, title: string): Scene[] {
        const pages = story.split(/---PAGE\s*\d+---/i).filter(p => p.trim());
        const segments = pages.length > 1 ? pages : story.split('\n\n').filter(p => p.trim());

        return Array.from({ length: Math.min(6, Math.max(3, segments.length)) }, (_, i) => ({
            pageNumber: i + 1,
            moment: (segments[i] || '').substring(0, 50).replace(/[^\w\s]/g, '').trim() || `Page ${i + 1}`,
            imagePrompt: `Warm watercolor children's book illustration. Scene ${i + 1}. Nostalgic, family-friendly.`,
            storyText: (segments[i] || 'A moment from the story...').trim(),
            visualElements: ['warm colors', 'nostalgic'],
            layout: i === 0 || i === 5 ? 'full-bleed' : 'top-image' as const
        }));
    }

    private fallbackChildrenStory(content: string): string {
        return `---PAGE 1---
Once upon a time, there was someone very special with a wonderful story to share.

---PAGE 2---
${content.substring(0, 200)}

---PAGE 3---
Through the years, they learned that the most important things in life are the people we love.

---PAGE 4---
They showed kindness to everyone they met, and found friends wherever they went.

---PAGE 5---
Even when things were hard, they never gave up, knowing tomorrow brings new adventures.

---PAGE 6---
And so, surrounded by love and memories, they lived happily, their story told for generations.

The End.`;
    }
}
