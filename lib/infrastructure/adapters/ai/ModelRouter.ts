/**
 * Model Router - Intelligent model selection based on task complexity.
 * 
 * Routes tasks to appropriate models to optimize for cost, latency,
 * and quality based on task requirements.
 * 
 * @module ModelRouter
 */

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
    /** Rate limit (requests per minute) */
    rateLimitRPM?: number;
}

/**
 * Budget constraints for routing.
 */
export interface CostBudget {
    /** Maximum cost per request in cents */
    maxCostCents?: number;
    /** Maximum latency in ms */
    maxLatencyMs?: number;
    /** Minimum quality score (0-1) */
    minQuality?: number;
    /** Preferred tier */
    preferredTier?: ModelTier;
    /** Force specific model */
    forceModel?: string;
}

/**
 * Routing decision.
 */
export interface RoutingDecision {
    /** Selected model */
    model: ModelConfig;
    /** Reason for selection */
    reason: string;
    /** Estimated cost for typical request */
    estimatedCostCents: number;
    /** Estimated latency */
    estimatedLatencyMs: number;
    /** Quality score for task */
    qualityScore: number;
    /** Alternative models considered */
    alternatives: ModelConfig[];
}

/**
 * Usage tracking for rate limiting.
 */
export interface UsageTracker {
    /** Requests in current window */
    requests: number;
    /** Window start time */
    windowStart: number;
    /** Window duration in ms */
    windowDurationMs: number;
}

// ============================================================================
// Default Models
// ============================================================================

/**
 * Pre-configured models.
 */
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
        available: true,
        rateLimitRPM: 30, // hopeful higher limit for lite
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
        available: true,
        rateLimitRPM: 10, // Hopeful higher limit
    },
    {
        id: 'gemini-1.5-pro-001', // Fallback
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        tier: ModelTier.PRO,
        costPer1KInputTokens: 0.125,
        costPer1KOutputTokens: 0.375,
        maxContextTokens: 2000000,
        maxOutputTokens: 8192,
        latencyP50Ms: 1000,
        latencyP95Ms: 3000,
        capabilities: [
            TaskComplexity.SAFETY_CRITICAL,
            TaskComplexity.CODE,
        ],
        qualityScores: {
            [TaskComplexity.SAFETY_CRITICAL]: 0.95,
            [TaskComplexity.CODE]: 0.90,
        },
        available: false, // Mark as false if it 404s
        rateLimitRPM: 2,
    }
];

// ============================================================================
// Model Router
// ============================================================================

/**
 * Routes tasks to appropriate models based on requirements.
 * 
 * Usage:
 * ```typescript
 * const router = new ModelRouter();
 * 
 * // Route based on task complexity
 * const decision = router.route(TaskComplexity.REASONING, {
 *   maxCostCents: 5,
 *   minQuality: 0.8,
 * });
 * 
 * console.log(`Using ${decision.model.name}: ${decision.reason}`);
 * 
 * // Estimate cost
 * const cost = router.estimateCost(1000, 500, decision.model);
 * ```
 */
export class ModelRouter {
    private models: Map<string, ModelConfig> = new Map();
    private usageTrackers: Map<string, UsageTracker> = new Map();
    private defaultModel: string;

    constructor(models?: ModelConfig[], defaultModelId?: string) {
        // Load models
        const modelsToLoad = models || DEFAULT_MODELS;
        for (const model of modelsToLoad) {
            this.models.set(model.id, model);
        }

        // Set default
        this.defaultModel = defaultModelId || 'gemini-2.5-flash-lite';
    }

    // ============================================================================
    // Routing
    // ============================================================================

    /**
     * Route a task to an appropriate model.
     */
    route(task: TaskComplexity, budget?: CostBudget): RoutingDecision {
        // If forced model, use it
        if (budget?.forceModel) {
            const forced = this.models.get(budget.forceModel);
            if (forced && forced.available) {
                return this.createDecision(forced, task, 'Forced by budget constraint', []);
            }
        }

        // Get candidate models
        const candidates = this.getCandidates(task, budget);

        if (candidates.length === 0) {
            // Fallback to default
            const fallback = this.models.get(this.defaultModel)!;
            return this.createDecision(fallback, task, 'No candidates met constraints, using default', []);
        }

        // Score and sort candidates
        const scored = candidates.map((model) => ({
            model,
            score: this.scoreModel(model, task, budget),
        }));

        scored.sort((a, b) => b.score - a.score);

        const selected = scored[0].model;
        const alternatives = scored.slice(1, 4).map((s) => s.model);

        return this.createDecision(
            selected,
            task,
            this.explainSelection(selected, task, budget),
            alternatives
        );
    }

    /**
     * Get candidate models for a task.
     */
    private getCandidates(task: TaskComplexity, budget?: CostBudget): ModelConfig[] {
        return Array.from(this.models.values()).filter((model) => {
            // Must be available
            if (!model.available) return false;

            // Must support the task
            if (!model.capabilities.includes(task)) return false;

            // Check rate limit
            if (!this.checkRateLimit(model.id)) return false;

            // Check budget constraints
            if (budget) {
                // Check cost (estimate for 1K tokens each way)
                if (budget.maxCostCents) {
                    const estimatedCost = this.estimateCost(1000, 500, model);
                    if (estimatedCost > budget.maxCostCents) return false;
                }

                // Check latency
                if (budget.maxLatencyMs && model.latencyP50Ms > budget.maxLatencyMs) {
                    return false;
                }

                // Check quality
                if (budget.minQuality) {
                    const quality = model.qualityScores[task] || 0;
                    if (quality < budget.minQuality) return false;
                }

                // Check preferred tier
                if (budget.preferredTier && model.tier !== budget.preferredTier) {
                    // Don't filter out, just deprioritize (handled in scoring)
                }
            }

            return true;
        });
    }

    /**
     * Score a model for a task.
     */
    private scoreModel(model: ModelConfig, task: TaskComplexity, budget?: CostBudget): number {
        let score = 0;

        // Quality weight (40%)
        const quality = model.qualityScores[task] || 0.5;
        score += quality * 40;

        // Cost efficiency weight (30%)
        const typicalCost = this.estimateCost(1000, 500, model);
        const costEfficiency = 1 / (1 + typicalCost);
        score += costEfficiency * 30;

        // Latency weight (20%)
        const latencyScore = 1 / (1 + model.latencyP50Ms / 1000);
        score += latencyScore * 20;

        // Tier bonus (10%)
        const tierBonus = this.getTierBonus(model.tier, task);
        score += tierBonus * 10;

        // Budget preference bonus
        if (budget?.preferredTier === model.tier) {
            score += 5;
        }

        return score;
    }

    /**
     * Get tier bonus based on task.
     */
    private getTierBonus(tier: ModelTier, task: TaskComplexity): number {
        // Safety critical tasks prefer PRO/ULTRA
        if (task === TaskComplexity.SAFETY_CRITICAL) {
            if (tier === ModelTier.PRO || tier === ModelTier.ULTRA) return 1;
            return 0;
        }

        // Simple tasks prefer FLASH
        if ([TaskComplexity.CLASSIFICATION, TaskComplexity.FORMATTING].includes(task)) {
            if (tier === ModelTier.FLASH) return 1;
            return 0.5;
        }

        // Reasoning/creative prefer PRO
        if ([TaskComplexity.REASONING, TaskComplexity.CREATIVE].includes(task)) {
            if (tier === ModelTier.PRO || tier === ModelTier.ULTRA) return 1;
            return 0.3;
        }

        return 0.5;
    }

    /**
     * Create a routing decision.
     */
    private createDecision(
        model: ModelConfig,
        task: TaskComplexity,
        reason: string,
        alternatives: ModelConfig[]
    ): RoutingDecision {
        return {
            model,
            reason,
            estimatedCostCents: this.estimateCost(1000, 500, model),
            estimatedLatencyMs: model.latencyP50Ms,
            qualityScore: model.qualityScores[task] || 0.5,
            alternatives,
        };
    }

    /**
     * Explain why a model was selected.
     */
    private explainSelection(model: ModelConfig, task: TaskComplexity, budget?: CostBudget): string {
        const parts: string[] = [];

        parts.push(`Best match for ${task}`);

        const quality = model.qualityScores[task];
        if (quality) {
            parts.push(`quality=${(quality * 100).toFixed(0)}%`);
        }

        parts.push(`tier=${model.tier}`);

        if (budget?.maxCostCents) {
            const cost = this.estimateCost(1000, 500, model);
            parts.push(`estimated cost ${cost.toFixed(2)}¢ within budget`);
        }

        return parts.join(', ');
    }

    // ============================================================================
    // Cost Estimation
    // ============================================================================

    /**
     * Estimate cost for a request.
     */
    estimateCost(inputTokens: number, outputTokens: number, model: ModelConfig): number {
        const inputCost = (inputTokens / 1000) * model.costPer1KInputTokens;
        const outputCost = (outputTokens / 1000) * model.costPer1KOutputTokens;
        return inputCost + outputCost;
    }

    /**
     * Estimate cost using model ID.
     */
    estimateCostById(inputTokens: number, outputTokens: number, modelId: string): number {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`[ModelRouter] Model not found: ${modelId}`);
        }
        return this.estimateCost(inputTokens, outputTokens, model);
    }

    // ============================================================================
    // Rate Limiting
    // ============================================================================

    /**
     * Check if a model is within rate limits.
     */
    private checkRateLimit(modelId: string): boolean {
        const model = this.models.get(modelId);
        if (!model?.rateLimitRPM) return true;

        let tracker = this.usageTrackers.get(modelId);
        const now = Date.now();
        const windowDuration = 60000; // 1 minute

        if (!tracker || now - tracker.windowStart > windowDuration) {
            // Start new window
            tracker = { requests: 0, windowStart: now, windowDurationMs: windowDuration };
            this.usageTrackers.set(modelId, tracker);
        }

        return tracker.requests < model.rateLimitRPM;
    }

    /**
     * Record a request for rate limiting.
     */
    recordRequest(modelId: string): void {
        let tracker = this.usageTrackers.get(modelId);
        const now = Date.now();
        const windowDuration = 60000;

        if (!tracker || now - tracker.windowStart > windowDuration) {
            tracker = { requests: 0, windowStart: now, windowDurationMs: windowDuration };
        }

        tracker.requests++;
        this.usageTrackers.set(modelId, tracker);
    }

    // ============================================================================
    // Model Management
    // ============================================================================

    /**
     * Get a model by ID.
     */
    getModel(id: string): ModelConfig | undefined {
        return this.models.get(id);
    }

    /**
     * List all models.
     */
    listModels(): ModelConfig[] {
        return Array.from(this.models.values());
    }

    /**
     * List available models.
     */
    listAvailable(): ModelConfig[] {
        return this.listModels().filter((m) => m.available);
    }

    /**
     * List models by tier.
     */
    listByTier(tier: ModelTier): ModelConfig[] {
        return this.listModels().filter((m) => m.tier === tier);
    }

    /**
     * Add or update a model.
     */
    registerModel(model: ModelConfig): void {
        this.models.set(model.id, model);
    }

    /**
     * Set model availability.
     */
    setAvailability(modelId: string, available: boolean): void {
        const model = this.models.get(modelId);
        if (model) {
            model.available = available;
        }
    }

    /**
     * Get cheapest model for a task.
     */
    getCheapest(task: TaskComplexity): ModelConfig | undefined {
        const candidates = this.getCandidates(task);
        if (candidates.length === 0) return undefined;

        return candidates.reduce((cheapest, model) => {
            const cheapestCost = this.estimateCost(1000, 500, cheapest);
            const modelCost = this.estimateCost(1000, 500, model);
            return modelCost < cheapestCost ? model : cheapest;
        });
    }

    /**
     * Get fastest model for a task.
     */
    getFastest(task: TaskComplexity): ModelConfig | undefined {
        const candidates = this.getCandidates(task);
        if (candidates.length === 0) return undefined;

        return candidates.reduce((fastest, model) =>
            model.latencyP50Ms < fastest.latencyP50Ms ? model : fastest
        );
    }

    /**
     * Get highest quality model for a task.
     */
    getBest(task: TaskComplexity): ModelConfig | undefined {
        const candidates = this.getCandidates(task);
        if (candidates.length === 0) return undefined;

        return candidates.reduce((best, model) => {
            const bestQuality = best.qualityScores[task] || 0;
            const modelQuality = model.qualityScores[task] || 0;
            return modelQuality > bestQuality ? model : best;
        });
    }
}
