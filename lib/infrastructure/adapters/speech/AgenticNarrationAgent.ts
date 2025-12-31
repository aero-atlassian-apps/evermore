/**
 * Agentic Narration Agent - Orchestrated TTS Pipeline
 * 
 * Uses agentic patterns for context-aware text-to-speech:
 * - Chain-of-Thought for text preprocessing (emotion detection → voice selection)
 * - Tool-based processing (markdown stripping, pause insertion, SSML enhancement)
 * - Fallback chain orchestration (ElevenLabs → Google → Browser)
 * 
 * @module AgenticNarrationAgent
 */

import { LLMPort } from '../../../core/application/ports/LLMPort';
import {
    ToolContract,
    ToolResult,
    ToolRegistry,
    ToolCapability,
    ToolPermission
} from '../../../core/application/agent/tools/ToolContracts';
import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface NarrationResult {
    audioUrl?: string;
    audioBase64?: string;
    mimeType: string;
    text: string;
    duration?: number;
    provider: 'elevenlabs' | 'google' | 'browser' | 'fallback';
    emotionalTone: string;
    voiceId?: string;
}

export interface NarrationOptions {
    preferredVoice?: string;
    speed?: number;
    emotion?: string;
    context?: {
        gender?: string;
        age?: string;
        name?: string;
    };
}

// ============================================================================
// Tool Contracts - Narration Processing Tools
// ============================================================================

const createPrepareTextForSpeechTool = (): ToolContract<{ text: string }, { preparedText: string; wordCount: number }> => ({
    metadata: {
        id: 'prepare-text-speech',
        name: 'Prepare Text for Speech',
        description: 'Strip markdown, add natural pauses, format for TTS',
        usageHint: 'Always use before sending to TTS',
        version: '1.0.0',
        capabilities: [ToolCapability.WRITE],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 0,
        estimatedLatencyMs: 50,
        enabled: true,
    },
    inputSchema: z.object({
        text: z.string()
    }),
    outputSchema: z.object({
        preparedText: z.string(),
        wordCount: z.number()
    }),
    async execute(input): Promise<ToolResult<{ preparedText: string; wordCount: number }>> {
        const startTime = Date.now();

        const preparedText = input.text
            // Remove markdown headers, convert to natural pauses
            .replace(/^#{1,6}\s+(.+)$/gm, '$1.')
            // Remove emphasis markers but keep the text
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/_(.+?)_/g, '$1')
            // Remove links, keep text
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')
            // Replace em-dashes for better flow
            .replace(/–/g, ', ')
            .replace(/—/g, '... ')
            // Add slight pauses for ellipsis
            .replace(/\.\.\./g, '... ')
            // Numbers to words for common cases
            .replace(/\b(\d{1,2})\b/g, (match) => numberToWords(parseInt(match)) || match)
            // Clean up extra whitespace
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return {
            success: true,
            data: {
                preparedText,
                wordCount: preparedText.split(/\s+/).length
            },
            durationMs: Date.now() - startTime,
        };
    }
});

const createDetectEmotionForVoiceTool = (llm: LLMPort): ToolContract<{ text: string }, { emotion: string; voiceStyle: string }> => ({
    metadata: {
        id: 'detect-emotion-voice',
        name: 'Detect Emotion for Voice Selection',
        description: 'Analyze text emotion to select appropriate voice style and pacing',
        usageHint: 'Use for emotion-aware TTS',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 1500,
        enabled: true,
    },
    inputSchema: z.object({
        text: z.string()
    }),
    outputSchema: z.object({
        emotion: z.string(),
        voiceStyle: z.string()
    }),
    async execute(input): Promise<ToolResult<{ emotion: string; voiceStyle: string }>> {
        const startTime = Date.now();

        try {
            const prompt = `Analyze the emotional tone for voice narration.
TEXT (first 500 chars): ${input.text.substring(0, 500)}

OUTPUT JSON:
{
  "emotion": "joyful|nostalgic|melancholic|warm|hopeful|neutral",
  "voiceStyle": "warm-storytelling|gentle-reflective|energetic|somber|neutral",
  "suggestedPace": "slow|moderate|normal"
}`;

            const parsed = await llm.generateJson<{ emotion: string; voiceStyle: string }>(prompt);
            return {
                success: true,
                data: {
                    emotion: parsed.emotion || 'neutral',
                    voiceStyle: parsed.voiceStyle || 'warm-storytelling'
                },
                durationMs: Date.now() - startTime,
                tokenUsage: { input: 200, output: 50 }
            };
        } catch (error: any) {
            return {
                success: true,
                data: { emotion: 'neutral', voiceStyle: 'warm-storytelling' },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

// ============================================================================
// Agentic Narration Agent
// ============================================================================

export class AgenticNarrationAgent {
    private toolRegistry: ToolRegistry;

    constructor(private llm: LLMPort) {
        this.toolRegistry = new ToolRegistry();
        this.toolRegistry.register(createPrepareTextForSpeechTool());
        this.toolRegistry.register(createDetectEmotionForVoiceTool(llm));
    }

    async prepareNarration(text: string, options?: NarrationOptions): Promise<{
        preparedText: string;
        emotion: string;
        voiceStyle: string;
        wordCount: number;
    }> {
        console.log('🎙️ Agentic Narration - Preparing text for speech');

        const executionContext = {
            userId: 'narration-agent',
            sessionId: `narration-${Date.now()}`,
            agentId: 'narration-agent',
            requestId: crypto.randomUUID(),
            permissions: new Map<string, ToolPermission>(),
            dryRun: false,
        };

        // Step 1: Prepare text (strip markdown, add pauses)
        const prepResult = await this.toolRegistry.execute(
            'prepare-text-speech',
            { text },
            executionContext
        );

        const preparedText = (prepResult.data as any)?.preparedText || text;
        const wordCount = (prepResult.data as any)?.wordCount || text.split(/\s+/).length;

        // Step 2: Detect emotion for voice selection (if not specified)
        let emotion = options?.emotion || 'neutral';
        let voiceStyle = 'warm-storytelling';

        // BIAS: If user context implies gender, maybe bias default voice?
        // Note: ElevenLabs voices are specific. We map "voiceStyle" to ID.
        // We can add logic here: if context.gender == 'female', prefer female voices.

        if (!options?.emotion) {
            const emotionResult = await this.toolRegistry.execute(
                'detect-emotion-voice',
                { text: preparedText },
                executionContext
            );
            emotion = (emotionResult.data as any)?.emotion || 'neutral';
            voiceStyle = (emotionResult.data as any)?.voiceStyle || 'warm-storytelling';
        }

        // Apply Gender Bias to Voice Style if neutral
        if (options?.context?.gender === 'female' && voiceStyle === 'warm-storytelling') {
            // For now, map to a female equivalent if available, or rely on selectVoice mapping
            // 'gentle-reflective' is Bella (female).
            // 'warm-storytelling' is Adam (male).
            // Let's implement simple bias:
            if (voiceStyle === 'warm-storytelling') voiceStyle = 'gentle-reflective';
        }

        console.log(`   ✓ Prepared: ${wordCount} words, emotion: ${emotion}, style: ${voiceStyle}`);

        return { preparedText, emotion, voiceStyle, wordCount };
    }

    /**
     * Select appropriate ElevenLabs voice based on emotion
     */
    selectVoice(emotion: string, voiceStyle: string): string {
        const voiceMap: Record<string, string> = {
            'warm-storytelling': 'pNInz6obpgDQGcFmaJgB', // Adam
            'gentle-reflective': 'EXAVITQu4vr4xnSDxMaL', // Bella
            'energetic': '21m00Tcm4TlvDq8ikWAM', // Rachel
            'somber': 'AZnzlk1XvdvUeBnXmlld', // Domi
            'neutral': 'pNInz6obpgDQGcFmaJgB', // Adam default
        };
        return voiceMap[voiceStyle] || voiceMap['neutral'];
    }

    /**
     * Estimate narration duration (avg 150 words/min for storytelling)
     */
    estimateDuration(wordCount: number, pace: 'slow' | 'moderate' | 'normal' = 'moderate'): number {
        const wordsPerMinute = pace === 'slow' ? 120 : pace === 'moderate' ? 140 : 160;
        return Math.ceil((wordCount / wordsPerMinute) * 60);
    }
}

// Helper function for number to words
function numberToWords(num: number): string | null {
    if (num < 0 || num > 99) return null;
    const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
        'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
        'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if (num < 20) return ones[num];
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return one ? `${tens[ten]}-${ones[one]}` : tens[ten];
}
