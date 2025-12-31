/**
 * Model Router - Intelligent model selection based on task complexity.
 * 
 * Routes tasks to appropriate models to optimize for cost, latency,
 * and quality based on task requirements.
 * 
 * @module ModelRouter
 */

import { AgentContext } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Task complexity categories.
 */
export enum TaskComplexity {
    /** Simple classification tasks */
    CLASSIFICATION = 'CLASSIFICATION',
    /** Entity/information extraction */
    EXTRACTION = 'EXTRACTION',
    /** Complex reasoning tasks */
    REASONING = 'REASONING',
    /** Creative content generation */
    CREATIVE = 'CREATIVE',
    /** Safety-critical tasks requiring high accuracy */
    SAFETY_CRITICAL = 'SAFETY_CRITICAL',
    /** Simple text formatting/transformation */
    FORMATTING = 'FORMATTING',
    /** Summarization tasks */
    SUMMARIZATION = 'SUMMARIZATION',
    /** Code generation */
    CODE = 'CODE',
}

/**
 * Model capability tier.
 */
export enum ModelTier {
    /** Fast, cheap, lower quality */
    FLASH = 'FLASH',
    /** Balanced performance */
    STANDARD = 'STANDARD',
    /** High quality, higher cost */
    PRO = 'PRO',
    /** Maximum quality, highest cost */
    ULTRA = 'ULTRA',
}

/**
 * Model profiles for adaptive selection.
 */
export enum ModelProfile {
    /** Optimized for speed and cost */
    FAST = 'FAST',
    /** Balanced performance */
    BALANCED = 'BALANCED',
    /** Optimized for high reasoning quality */
    REASONING = 'REASONING',
    /** Optimized for safety/compliance */
    SAFETY = 'SAFETY',
}

/**
 * Configuration for a model.
 */
export interface ModelConfig {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Provider (e.g., 'google', 'openai') */
    provider: string;
    /** Model tier */
    tier: ModelTier;
    /** Cost per 1K input tokens (cents) */
    costPer1KInputTokens: number;
    /** Cost per 1K output tokens (cents) */
    costPer1KOutputTokens: number;
    /** Maximum context tokens */
    maxContextTokens: number;
    /** Maximum output tokens */
    maxOutputTokens: number;
    /** Typical P50 latency in ms */
    latencyP50Ms: number;
    /** Typical P95 latency in ms */
    latencyP95Ms: number;
    /** Task types this model is good at */
    capabilities: TaskComplexity[];
    /** Quality score (0-1) for various tasks */
    qualityScores: Partial<Record<TaskComplexity, number>>;
    /** Whether the model is available */
    available: boolean;
}

/**
 * Budget constraints for routing.
 */
export interface RoutingBudget {
    /** Total cost budget remaining for session */
    totalCostRemaining?: number;
    /** Maximum cost per individual request */
    maxRequestCostCents?: number;
    /** Preferred tier */
    preferredTier?: ModelTier;
    /** Minimum quality threshold (0-1) */
    minQuality?: number;
}

/**
 * Routing decision.
 */
export interface RoutingDecision {
    /** Selected model ID */
    modelId: string;
    /** Selected model config */
    model: ModelConfig;
    /** Reason for selection */
    reason: string;
}

// ============================================================================
// Default Models
// ============================================================================

export const DEFAULT_MODELS: ModelConfig[] = [
    {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash-Lite',
        provider: 'google',
        tier: ModelTier.FLASH,
        costPer1KInputTokens: 0.05,
        costPer1KOutputTokens: 0.15,
        maxContextTokens: 1000000,
        maxOutputTokens: 8192,
        latencyP50Ms: 500,
        latencyP95Ms: 1500,
        capabilities: [
            TaskComplexity.CLASSIFICATION,
            TaskComplexity.EXTRACTION,
            TaskComplexity.FORMATTING,
            TaskComplexity.SUMMARIZATION,
            TaskComplexity.REASONING,
            TaskComplexity.CREATIVE,
        ],
        qualityScores: {
            [TaskComplexity.CLASSIFICATION]: 0.90,
            [TaskComplexity.EXTRACTION]: 0.88,
            [TaskComplexity.FORMATTING]: 0.92,
            [TaskComplexity.SUMMARIZATION]: 0.85,
            [TaskComplexity.REASONING]: 0.82,
            [TaskComplexity.CREATIVE]: 0.80,
        },
        available: true
    },
    {
        id: 'gemini-2.0-flash-lite-preview-02-05',
        name: 'Gemini 2.0 Flash-Lite (Preview)',
        provider: 'google',
        tier: ModelTier.FLASH,
        costPer1KInputTokens: 0.05,
        costPer1KOutputTokens: 0.15,
        maxContextTokens: 1000000,
        maxOutputTokens: 8192,
        latencyP50Ms: 400,
        latencyP95Ms: 1200,
        capabilities: [
            TaskComplexity.CLASSIFICATION,
            TaskComplexity.EXTRACTION,
            TaskComplexity.FORMATTING,
        ],
        qualityScores: {
            [TaskComplexity.CLASSIFICATION]: 0.85,
            [TaskComplexity.EXTRACTION]: 0.80,
            [TaskComplexity.FORMATTING]: 0.90,
        },
        available: true
    }
];

// ============================================================================
// Model Router Implementation
// ============================================================================

export class ModelRouter {
    private models: Map<string, ModelConfig> = new Map();

    constructor(models: ModelConfig[] = DEFAULT_MODELS) {
        for (const m of models) {
            this.models.set(m.id, m);
        }
    }

    /**
     * Analyze a prompt to determine its complexity.
     * Heuristics based on length, intent keywords, and structure.
     */
    analyzeComplexity(prompt: string): TaskComplexity {
        const text = prompt.toLowerCase();

        // 1. Safety Critical check
        if (text.includes('harm') || text.includes('hurt') || text.includes('emergency') || text.includes('danger')) {
            return TaskComplexity.SAFETY_CRITICAL;
        }

        // 2. Reasoning check (AoT, Plan, Logical steps)
        if (text.includes('plan') || text.includes('reason') || text.includes('step by step') || text.includes('analyze')) {
            return TaskComplexity.REASONING;
        }

        // 3. Extraction check
        if (text.includes('extract') || text.includes('list') || text.includes('entities')) {
            return TaskComplexity.EXTRACTION;
        }

        // 4. Summarization check
        if (text.includes('summarize') || text.includes('tldr') || text.includes('brief')) {
            return TaskComplexity.SUMMARIZATION;
        }

        // 5. Default to Classification/Formatting for simple inputs
        if (prompt.length < 100) {
            return TaskComplexity.CLASSIFICATION;
        }

        return TaskComplexity.REASONING; // Default for longer prompts
    }

    /**
     * Select the best model based on task and budget.
     */
    route(task: TaskComplexity, budget: RoutingBudget): RoutingDecision {
        const candidates = Array.from(this.models.values()).filter(m => m.available);

        // Filter by quality
        const filtered = candidates.filter(m => (m.qualityScores[task] || 0) >= (budget.minQuality || 0));

        // Budget Awareness: If budget is very low (< 5 cents), force FLASH tier if possible
        if (budget.totalCostRemaining !== undefined && budget.totalCostRemaining < 5) {
            const flashModels = filtered.filter(m => m.tier === ModelTier.FLASH);
            if (flashModels.length > 0) {
                return {
                    modelId: flashModels[0].id,
                    model: flashModels[0],
                    reason: 'Low budget (< 5¢ remaining), forcing Flash tier.'
                };
            }
        }

        // Standard logic: Sort by score (quality * cost_efficiency)
        const scored = filtered.map(m => {
            const quality = m.qualityScores[task] || 0.5;
            const cost = (m.costPer1KInputTokens + m.costPer1KOutputTokens) / 2;
            const score = quality / (cost + 0.1); // Cost efficiency score
            return { model: m, score };
        });

        scored.sort((a, b) => b.score - a.score);

        const best = scored[0]?.model || Array.from(this.models.values())[0];

        return {
            modelId: best.id,
            model: best,
            reason: `Optimized for ${task} with quality ${best.qualityScores[task] || 'N/A'}`
        };
    }
}
