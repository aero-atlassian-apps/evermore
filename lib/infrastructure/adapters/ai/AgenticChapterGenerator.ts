/**
 * Agentic Chapter Generator - Orchestrated Chapter Generation
 * 
 * Uses EnhancedReActAgent with proper tool contracts for chapter generation.
 * This replaces simple LLM wrappers with full agentic orchestration.
 * 
 * @module AgenticChapterGenerator
 */

import { ChapterGeneratorPort, ChapterGeneratorResult, ChapterGenerationContext } from '../../../core/application/ports/ChapterGeneratorPort';
import { LLMPort } from '../../../core/application/ports/LLMPort';
import { EnhancedReActAgent } from '../../../core/application/agent/EnhancedReActAgent';
import {
    ToolContract,
    ToolResult,
    ToolMetadata,
    ToolRegistry,
    ToolCapability,
    ToolPermission
} from '../../../core/application/agent/tools/ToolContracts';
import { ModelRouter, ModelProfile, DEFAULT_MODELS } from '../../../core/application/agent/routing/ModelRouter';
import { z } from 'zod';

// ============================================================================
// Tool Contracts for Chapter Generation
// ============================================================================

const createExtractNarrativeArcTool = (llm: LLMPort): ToolContract<{ transcript: string }, { narrativeArc: string }> => ({
    metadata: {
        id: 'extract-narrative-arc',
        name: 'Extract Narrative Arc',
        description: 'Analyze transcript to identify the primary narrative arc and story theme',
        usageHint: 'Use this first to understand the main story',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 2000,
        enabled: true,
    },
    inputSchema: z.object({
        transcript: z.string().describe('The conversation transcript to analyze')
    }),
    outputSchema: z.object({
        narrativeArc: z.string()
    }),
    async execute(input: { transcript: string }): Promise<ToolResult<{ narrativeArc: string }>> {
        const startTime = Date.now();
        try {
            const prompt = `Analyze this transcript and identify the primary narrative arc in ONE sentence (10-20 words):
TRANSCRIPT: ${input.transcript.substring(0, 2000)}
OUTPUT: Just the narrative arc sentence, nothing else.`;

            const result = await llm.generateText(prompt, { maxTokens: 50 });
            return {
                success: true,
                data: { narrativeArc: result.trim() },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 500, output: 50 }
            };
        } catch (error: any) {
            return {
                success: false,
                error: { code: 'NARRATIVE_EXTRACTION_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createExtractQuotesTool = (llm: LLMPort): ToolContract<{ transcript: string }, { quotes: any[] }> => ({
    metadata: {
        id: 'extract-quotes',
        name: 'Extract Best Quotes',
        description: 'Select the 2-3 best emotionally resonant quotes from transcript',
        usageHint: 'Use to find memorable quotes to include in chapter',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 2000,
        enabled: true,
    },
    inputSchema: z.object({
        transcript: z.string()
    }),
    outputSchema: z.object({
        quotes: z.array(z.any())
    }),
    async execute(input: { transcript: string }): Promise<ToolResult<{ quotes: any[] }>> {
        const startTime = Date.now();
        try {
            const prompt = `Select 2-3 best quotes from this conversation.
TRANSCRIPT: ${input.transcript.substring(0, 2000)}
OUTPUT JSON: { "quotes": [{ "text": "...", "reason": "..." }] }`;

            const parsed = await llm.generateJson<{ quotes: any[] }>(prompt);
            return {
                success: true,
                data: { quotes: parsed.quotes || [] },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 500, output: 150 }
            };
        } catch (error: any) {
            return {
                success: false,
                data: { quotes: [] },
                error: { code: 'QUOTE_EXTRACTION_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createDetectEmotionTool = (llm: LLMPort): ToolContract<{ transcript: string }, { emotion: string; confidence: number }> => ({
    metadata: {
        id: 'detect-emotion',
        name: 'Detect Emotional Tone',
        description: 'Determine the primary emotional valence of the story',
        usageHint: 'Use to understand the emotional tone for appropriate writing style',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 1500,
        enabled: true,
    },
    inputSchema: z.object({
        transcript: z.string()
    }),
    outputSchema: z.object({
        emotion: z.string(),
        confidence: z.number()
    }),
    async execute(input: { transcript: string }): Promise<ToolResult<{ emotion: string; confidence: number }>> {
        const startTime = Date.now();
        try {
            const prompt = `Determine the primary emotional valence.
TRANSCRIPT: ${input.transcript.substring(0, 1500)}
OUTPUT JSON: { "emotion": "joy|sadness|nostalgia|pride|love|neutral", "confidence": 0.85, "evidence": "brief reason" }`;

            const parsed = await llm.generateJson<{ emotion: string; confidence: number }>(prompt);
            return {
                success: true,
                data: { emotion: parsed.emotion || 'neutral', confidence: parsed.confidence || 0.5 },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 400, output: 50 }
            };
        } catch (error: any) {
            return {
                success: false,
                data: { emotion: 'neutral', confidence: 0.5 },
                error: { code: 'EMOTION_DETECTION_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createExtractSettingTool = (llm: LLMPort): ToolContract<{ transcript: string }, { setting: any }> => ({
    metadata: {
        id: 'extract-setting',
        name: 'Extract Setting',
        description: 'Identify time period, location, and atmosphere',
        usageHint: 'Use to ground the story in a specific reality',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 2000,
        enabled: true,
    },
    inputSchema: z.object({ transcript: z.string() }),
    outputSchema: z.object({ setting: z.any() }),
    async execute(input): Promise<ToolResult<{ setting: any }>> {
        const startTime = Date.now();
        const prompt = `Extract SETTING details.
TRANSCRIPT: ${input.transcript.substring(0, 1500)}
CRITICAL: Infer DECADE (1950s?), LOCATION (Beirut?), ATMOSPHERE (Warm?).
OUTPUT JSON: { "setting": { "timePeriod": "...", "location": "...", "atmosphere": "..." } }`;
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

const createExtractSensoryDetailsTool = (llm: LLMPort): ToolContract<{ transcript: string }, { sensoryDetails: string[] }> => ({
    metadata: {
        id: 'extract-sensory',
        name: 'Extract Sensory Details',
        description: 'Extract vivid sights, sounds, smells, and textures',
        usageHint: 'Use to make the story immersive',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 2000,
        enabled: true,
    },
    inputSchema: z.object({ transcript: z.string() }),
    outputSchema: z.object({ sensoryDetails: z.array(z.string()) }),
    async execute(input): Promise<ToolResult<{ sensoryDetails: string[] }>> {
        const startTime = Date.now();
        const prompt = `Extract 5 vivid SENSORY details (Sights, Sounds, Smells, Textures) from this transcript.
TRANSCRIPT: ${input.transcript.substring(0, 1500)}
OUTPUT JSON: { "sensoryDetails": ["smell of jasmine", "rough stone walls", ...] }`;
        try {
            const parsed = await llm.generateJson<{ sensoryDetails: string[] }>(prompt);
            return {
                success: true,
                data: { sensoryDetails: parsed.sensoryDetails || [] },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 500, output: 150 }
            };
        } catch (error: any) {
            return {
                success: false,
                data: { sensoryDetails: [] },
                error: { code: 'SENSORY_EXTRACTION_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createSynthesizeChapterTool = (llm: LLMPort): ToolContract<any, { chapter: string }> => ({
    metadata: {
        id: 'synthesize-chapter',
        name: 'Synthesize Chapter',
        description: 'Transform memories into a personal story from storyteller to family',
        usageHint: 'Use after gathering all insights to create the final chapter',
        version: '1.0.0',
        capabilities: [ToolCapability.WRITE],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 5,
        estimatedLatencyMs: 5000,
        enabled: true,
    },
    inputSchema: z.object({
        narrativeArc: z.string(),
        emotion: z.string(),
        quotes: z.array(z.any()),
        setting: z.any(),
        sensoryDetails: z.array(z.string()),
        transcript: z.string(),
        context: z.string().optional()
    }),
    outputSchema: z.object({
        chapter: z.string()
    }),
    async execute(input: any): Promise<ToolResult<{ chapter: string }>> {
        const startTime = Date.now();
        try {
            // Extract ONLY the storyteller's words - completely remove AI/interviewer
            const storytellerMemories = (input.transcript || '')
                .split('\n')
                .filter((line: string) => {
                    const lower = line.toLowerCase().trim();
                    // Remove ALL AI/assistant/system lines
                    return !lower.startsWith('ai:') &&
                        !lower.startsWith('assistant:') &&
                        !lower.startsWith('system:') &&
                        !lower.startsWith('evermore:') &&
                        !lower.includes('tell me more') &&
                        !lower.includes('that\'s wonderful') &&
                        !lower.includes('please continue');
                })
                .map((line: string) => line.replace(/^[^:]+:\s*/, '').trim()) // Remove speaker prefix
                .filter((line: string) => line.length > 0)
                .join(' ');

            const prompt = `You are ghostwriting a personal memory chapter for a grandparent to their grandchild.

ANALYSIS INSIGHTS:
- Theme: ${input.narrativeArc}
- Emotion: ${input.emotion}
- Setting: ${JSON.stringify(input.setting)}
- Sensory Details: ${JSON.stringify(input.sensoryDetails)}
- Quotes: ${JSON.stringify(input.quotes)}
- Context: ${input.context || 'None'}

SOURCE MEMORIES (Transform into FIRST PERSON narrative):
${storytellerMemories.substring(0, 1500)}

CRITICAL INSTRUCTIONS:
1. Write in FIRST PERSON ("I remember...", "When I was young...")
2. DIRECT story from grandparent to grandchild - NO AI, NO interviewer
3. NO production cues, NO stage directions
4. NO dialogue format
5. Warm, intimate, nostalgic tone
6. NO PLACEHOLDERS: Use "my grandchild", "my dear", or "little one" if name is unknown. NEVER use brackets like [Name].
7. SHOW DON'T TELL: Use the Sensory Details to transport the reader. Describe the location and atmosphere vividly.
8. IMMERSIVE: Make the reader feel they are there in that specific time period (${input.setting?.timePeriod || 'the past'}).

FORMAT: Title, Hook, Story (4-6 paras), Reflection.

Write the chapter now:
`;
            const chapter = await llm.generateText(prompt, { maxTokens: 1200 });
            return {
                success: true,
                data: { chapter },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 700, output: 1200 }
            };
        } catch (error: any) {
            return {
                success: false,
                error: { code: 'SYNTHESIS_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

// ============================================================================
// Agentic Chapter Generator
// ============================================================================

export class AgenticChapterGenerator implements ChapterGeneratorPort {
    private toolRegistry: ToolRegistry;

    constructor(private llm: LLMPort) {
        // Create and register tools
        this.toolRegistry = new ToolRegistry();
        this.toolRegistry.register(createExtractNarrativeArcTool(llm));
        this.toolRegistry.register(createExtractQuotesTool(llm));
        this.toolRegistry.register(createDetectEmotionTool(llm));
        this.toolRegistry.register(createExtractSettingTool(llm));
        this.toolRegistry.register(createExtractSensoryDetailsTool(llm));
        this.toolRegistry.register(createSynthesizeChapterTool(llm));
    }

    async generateChapter(transcript: string, previousChapters: any[] = [], context?: ChapterGenerationContext): Promise<ChapterGeneratorResult> {
        console.log('🤖 Agentic Chapter Generation - Orchestrated Pipeline');
        if (context) {
            console.log(`   Detailed Context Available: Day0=${context.isDayZero}, User=${context.userSeed?.name}, Memories=${context.memories?.length || 0}`);
        }

        const executionContext = {
            userId: 'chapter-generator',
            sessionId: `chapter-${Date.now()}`,
            agentId: 'biographer-agent',
            requestId: crypto.randomUUID(),
            permissions: new Map<string, ToolPermission>(),
            dryRun: false,
        };

        const atoms: any = {
            narrativeArc: '',
            bestQuotes: [],
            sensoryDetails: [],
            setting: {},
            emotionalValence: context?.cumulativeEmotionalState || 'neutral',
            previousChapterConnections: []
        };

        try {
            // STEP 1: Extract Narrative Arc
            console.log('   ├─ Step 1: Extracting narrative arc...');
            const narrativeResult = await this.toolRegistry.execute(
                'extract-narrative-arc',
                { transcript },
                executionContext
            );
            atoms.narrativeArc = (narrativeResult.data as any)?.narrativeArc || 'A special memory';
            console.log(`   │  ✓ Narrative: "${atoms.narrativeArc}"`);

            // STEP 2: Detect Emotion (parallel with quotes)
            console.log('   ├─ Step 2: Detecting emotion + extracting quotes...');
            const [emotionResult, quotesResult, settingResult, sensoryResult] = await Promise.all([
                this.toolRegistry.execute('detect-emotion', { transcript }, executionContext),
                this.toolRegistry.execute('extract-quotes', { transcript }, executionContext),
                this.toolRegistry.execute('extract-setting', { transcript }, executionContext),
                this.toolRegistry.execute('extract-sensory', { transcript }, executionContext),
            ]);

            atoms.emotionalValence = (emotionResult.data as any)?.emotion || 'neutral';
            atoms.bestQuotes = (quotesResult.data as any)?.quotes || [];
            atoms.setting = (settingResult.data as any)?.setting || {};
            atoms.sensoryDetails = (sensoryResult.data as any)?.sensoryDetails || [];
            console.log(`   │  ✓ Emotion: ${atoms.emotionalValence}, Quotes: ${atoms.bestQuotes.length}, Sensory: ${atoms.sensoryDetails.length}`);

            // STEP 3: Synthesize Chapter
            console.log('   ├─ Step 3: Synthesizing chapter...');

            // Prepare rich context
            const userContextString = context ? `
USER PROFILE: ${context.userSeed?.name || 'Unknown'} (${context.userSeed?.age || '?'}yo). ${context.userSeed?.bio || ''}
MEMORIES: ${context.memories?.join('; ') || 'None'}
THEMES: ${context.knownThemes?.join(', ') || 'None'}
EMOTIONAL SATE: ${context.cumulativeEmotionalState || 'neutral'}
            `.trim() : '';

            const synthesisResult = await this.toolRegistry.execute(
                'synthesize-chapter',
                {
                    narrativeArc: atoms.narrativeArc,
                    emotion: atoms.emotionalValence,
                    quotes: atoms.bestQuotes,
                    setting: atoms.setting,
                    sensoryDetails: atoms.sensoryDetails,
                    transcript,
                    context: userContextString // passing as extra field (need to update schema)
                },
                executionContext
            );

            const chapter = (synthesisResult.data as any)?.chapter || this.fallbackChapter(transcript);
            console.log(`   └─ ✨ Chapter generated (${chapter.length} chars)`);

            return { chapter, atoms };

        } catch (error: any) {
            console.error('Agentic chapter generation failed:', error);
            return this.fallbackGeneration(transcript);
        }
    }

    private fallbackChapter(_transcript: string): string {
        return `A Treasured Memory

The story begins as all great stories do, with a moment that would change everything.

In those days, life had a different rhythm. The world felt smaller, more intimate, and every moment seemed to carry weight. There were lessons learned, laughter shared, and quiet moments of reflection that would stay with us forever.

Some memories are like precious stones, polished by time until they shine with meaning. This is one of those memories.

And so the story lives on, a treasure passed from generation to generation.`;
    }

    private async fallbackGeneration(transcript: string): Promise<ChapterGeneratorResult> {
        // Extract ONLY the storyteller's words - completely remove AI/interviewer
        const storytellerMemories = (transcript || '')
            .split('\n')
            .filter((line: string) => {
                const lower = line.toLowerCase().trim();
                // Remove ALL AI/assistant/system lines
                return !lower.startsWith('ai:') &&
                    !lower.startsWith('assistant:') &&
                    !lower.startsWith('system:') &&
                    !lower.startsWith('evermore:') &&
                    !lower.includes('tell me more') &&
                    !lower.includes('that\'s wonderful');
            })
            .map((line: string) => line.replace(/^[^:]+:\s*/, '').trim()) // Remove speaker prefix
            .filter((line: string) => line.length > 0)
            .join(' ');

        const prompt = `You are ghostwriting a personal memory chapter for a grandparent.
Write this as a direct letter to their grandchild. NO AI. NO Interviewer.
FIRST PERSON perspective ("I remember...").
FIRST PERSON perspective ("I remember...").
Warm, nostalgic, personal.
NO PLACEHOLDERS (Use "my dear" etc instead of [Name]).

MEMORIES: ${storytellerMemories.substring(0, 2000)}`;

        try {
            const chapter = await this.llm.generateText(prompt, { maxTokens: 1200 });
            return {
                chapter,
                atoms: {
                    narrativeArc: 'Fallback generation',
                    bestQuotes: [],
                    sensoryDetails: [],
                    emotionalValence: 'neutral',
                    previousChapterConnections: []
                }
            };
        } catch {
            return {
                chapter: this.fallbackChapter(transcript),
                atoms: { narrativeArc: 'Fallback', bestQuotes: [], sensoryDetails: [], emotionalValence: 'neutral', previousChapterConnections: [] }
            };
        }
    }
}
