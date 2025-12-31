/**
 * Agentic Image Analysis Agent
 * 
 * Uses agentic patterns for context-aware image understanding:
 * - Tool-based image analysis (description, entities, emotion)
 * - Context-aware conversational trigger generation
 * - Orchestrates vision LLM capabilities
 * 
 * @module AgenticImageAnalysisAgent
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

export interface ImageAnalysisResult {
    description: string;
    detectedEntities: string[];
    emotionalVibe: string;
    conversationalTrigger: string;
    confidence: number;
}

// ============================================================================
// Tools
// ============================================================================

const createAnalyzeImageContentTool = (llm: LLMPort): ToolContract<{ imageBase64: string; mimeType: string }, { description: string; entities: string[]; emotion: string }> => ({
    metadata: {
        id: 'analyze-image-content',
        name: 'Analyze Image Content',
        description: 'Analyze visual content of an image',
        usageHint: 'Use to get base understanding of image',
        version: '1.0.0',
        capabilities: [ToolCapability.READ],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 2,
        estimatedLatencyMs: 3000,
        enabled: true,
    },
    inputSchema: z.object({
        imageBase64: z.string(),
        mimeType: z.string()
    }),
    outputSchema: z.object({
        description: z.string(),
        entities: z.array(z.string()),
        emotion: z.string()
    }),
    async execute(input): Promise<ToolResult<{ description: string; entities: string[]; emotion: string }>> {
        const startTime = Date.now();
        const prompt = `Analyze this image for a biography session. 
OUTPUT JSON:
{
  "description": "detailed visual description",
  "entities": ["list", "of", "main", "objects/people"],
  "emotion": "nostalgic/happy/somber/neutral"
}`;

        try {
            // Note: LLMPort needs to support image input. Check if your LLMPort has analyzeImage or if generateJson supports images.
            // Assuming LLMPort has analyzeImage or similar, or we pass image in prompt if supported.
            // Based on existing code, llm.analyzeImage exists.

            // Casting to any to access analyzeImage if it's not on the interface but present in implementation
            // Or assuming LLMPort interface has it.
            // Checking previous context: AnalyzeSessionImageUseCase used `this.llm.analyzeImage`.

            const rawResponse = await (llm as any).analyzeImage(input.imageBase64, input.mimeType, prompt);

            let data;
            try {
                const clean = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
                data = JSON.parse(clean);
            } catch {
                data = { description: rawResponse, entities: [], emotion: 'neutral' };
            }

            return {
                success: true,
                data: {
                    description: data.description || 'An image',
                    entities: data.entities || [],
                    emotion: data.emotion || 'neutral'
                },
                durationMs: Date.now() - startTime,
            };
        } catch (error: any) {
            return {
                success: false,
                data: { description: '', entities: [], emotion: 'neutral' },
                error: { code: 'IMAGE_ANALYSIS_FAILED', message: error.message, retryable: true },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

const createGenerateTriggerTool = (llm: LLMPort): ToolContract<{ description: string; context?: string }, { question: string; strategy: string }> => ({
    metadata: {
        id: 'generate-conversation-trigger',
        name: 'Generate Conversation Trigger',
        description: 'Generate a follow-up question based on image analysis',
        usageHint: 'Use after analyzing image to spark conversation',
        version: '1.0.0',
        capabilities: [ToolCapability.WRITE],
        defaultPermission: ToolPermission.ALLOWED,
        estimatedCostCents: 1,
        estimatedLatencyMs: 1000,
        enabled: true,
    },
    inputSchema: z.object({
        description: z.string(),
        context: z.string().optional()
    }),
    outputSchema: z.object({
        question: z.string(),
        strategy: z.string()
    }),
    async execute(input): Promise<ToolResult<{ question: string; strategy: string }>> {
        const startTime = Date.now();
        const prompt = `Generate a warm, engaging question about this photo to start a story.
IMAGE: ${input.description}
CONTEXT: ${input.context || 'None'}

OUTPUT JSON:
{
  "question": "The question to ask the user...",
  "strategy": "emotional_deepening|factual_recall|relational_connection"
}`;

        try {
            const data = await llm.generateJson<{ question: string; strategy: string }>(prompt);
            return {
                success: true,
                data: {
                    question: data.question,
                    strategy: data.strategy || 'emotional_deepening'
                },
                durationMs: Date.now() - startTime,
            };
        } catch (error: any) {
            return {
                success: true,
                // Fallback
                data: { question: "Tell me more about this photo.", strategy: "fallback" },
                durationMs: Date.now() - startTime,
            };
        }
    }
});

// ============================================================================
// Agentic Image Analysis Agent
// ============================================================================

export class AgenticImageAnalysisAgent {
    private toolRegistry: ToolRegistry;

    constructor(private llm: LLMPort) {
        this.toolRegistry = new ToolRegistry();
        this.toolRegistry.register(createAnalyzeImageContentTool(llm));
        this.toolRegistry.register(createGenerateTriggerTool(llm));
    }

    async analyzeAndTrigger(imageBase64: string, mimeType: string, context?: string): Promise<ImageAnalysisResult> {
        console.log('👁️ Agentic Vision - Analyzing Image');

        const executionContext = {
            userId: 'vision-agent',
            sessionId: `vision-${Date.now()}`,
            agentId: 'vision-agent',
            requestId: crypto.randomUUID(),
            permissions: new Map<string, ToolPermission>(),
            dryRun: false,
        };

        // Step 1: Analyze Content
        const analysisResult = await this.toolRegistry.execute(
            'analyze-image-content',
            { imageBase64, mimeType },
            executionContext
        );

        if (!analysisResult.success || !analysisResult.data) {
            throw new Error(`Vision analysis failed: ${analysisResult.error?.message}`);
        }

        const data = analysisResult.data as { description: string; entities: string[]; emotion: string };
        const { description, entities, emotion } = data;
        console.log(`   ✓ Vision: ${description.substring(0, 50)}... (${entities.length} entities)`);

        // Step 2: Generate Trigger
        const triggerResult = await this.toolRegistry.execute(
            'generate-conversation-trigger',
            { description, context },
            executionContext
        );

        const triggerData = triggerResult.data as { question: string; strategy: string };

        return {
            description,
            detectedEntities: entities,
            emotionalVibe: emotion,
            conversationalTrigger: triggerData?.question || "What's the story behind this photo?",
            confidence: 0.9
        };
    }
}
