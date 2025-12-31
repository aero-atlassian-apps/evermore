/**
 * Context Budget Manager - Token-aware context management.
 * 
 * Manages context sources with priority-based pruning to stay
 * within token budgets while preserving the most important information.
 * 
 * @module ContextBudgetManager
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Types of context sources.
 */
export type ContextSourceType =
    | 'system_prompt'
    | 'user_input'
    | 'conversation_history'
    | 'memories'
    | 'tool_results'
    | 'plan'
    | 'observations'
    | 'instructions'
    | 'examples';

/**
 * A single context source with content and metadata.
 */
export interface ContextSource {
    /** Unique identifier */
    id: string;
    /** Type of context */
    type: ContextSourceType;
    /** The actual content */
    content: string;
    /** Priority (higher = keep when pruning) */
    priority: number;
    /** Token count (if known) */
    tokens?: number;
    /** Whether this source is required and cannot be pruned */
    required: boolean;
    /** Metadata for debugging */
    metadata?: Record<string, unknown>;
    /** Timestamp when this was added */
    addedAt: number;
}

/**
 * Result of context optimization.
 */
export interface OptimizedContext {
    /** Combined context string */
    content: string;
    /** Sources included */
    includedSources: ContextSource[];
    /** Sources that were pruned */
    prunedSources: ContextSource[];
    /** Total tokens used */
    totalTokens: number;
    /** Token budget */
    budget: number;
    /** Percentage of budget used */
    utilizationPercent: number;
}

/**
 * Token breakdown by source type.
 */
export interface TokenBreakdown {
    /** Tokens per source type */
    byType: Record<ContextSourceType, number>;
    /** Tokens per source ID */
    byId: Record<string, number>;
    /** Total tokens */
    total: number;
}

/**
 * Strategy for pruning context.
 */
export type PruningStrategy =
    | 'priority'      // Remove lowest priority first
    | 'recency'       // Remove oldest first
    | 'size'          // Remove largest first
    | 'type'          // Remove by type order
    | 'smart';        // Combination of factors

/**
 * Configuration for the manager.
 */
export interface ContextBudgetConfig {
    /** Maximum tokens allowed */
    maxTokens: number;
    /** Reserve tokens for output */
    outputReserve: number;
    /** Pruning strategy */
    strategy: PruningStrategy;
    /** Priority order for types (used in 'type' strategy) */
    typeOrder?: ContextSourceType[];
    /** Whether to estimate tokens or require them */
    estimateTokens: boolean;
    /** Average characters per token for estimation */
    charsPerToken: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ContextBudgetConfig = {
    maxTokens: 100000,  // Gemini 1.5 Pro has 1M+, but we stay conservative
    outputReserve: 8000,
    strategy: 'smart',
    typeOrder: [
        'system_prompt',
        'user_input',
        'instructions',
        'examples',
        'plan',
        'conversation_history',
        'memories',
        'tool_results',
        'observations',
    ],
    estimateTokens: true,
    charsPerToken: 4,
};

// ============================================================================
// Context Budget Manager
// ============================================================================

/**
 * Manages context sources and ensures they fit within token budgets.
 * 
 * Usage:
 * ```typescript
 * const manager = new ContextBudgetManager({ maxTokens: 8000 });
 * 
 * manager.addSource({
 *   id: 'system',
 *   type: 'system_prompt',
 *   content: 'You are an empathetic biographer...',
 *   priority: 100,
 *   required: true,
 * });
 * 
 * manager.addSource({
 *   id: 'history',
 *   type: 'conversation_history',
 *   content: historyJson,
 *   priority: 50,
 *   required: false,
 * });
 * 
 * const optimized = manager.optimize();
 * console.log(optimized.content);
 * ```
 */
export class ContextBudgetManager {
    private config: ContextBudgetConfig;
    private sources: Map<string, ContextSource> = new Map();

    constructor(config?: Partial<ContextBudgetConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ============================================================================
    // Source Management
    // ============================================================================

    /**
     * Add a context source.
     */
    addSource(source: Omit<ContextSource, 'addedAt' | 'tokens'> & { tokens?: number }): void {
        const tokens = source.tokens ?? this.estimateTokens(source.content);

        this.sources.set(source.id, {
            ...source,
            tokens,
            addedAt: Date.now(),
        });
    }

    /**
     * Update an existing source.
     */
    updateSource(id: string, updates: Partial<Omit<ContextSource, 'id'>>): void {
        const existing = this.sources.get(id);
        if (!existing) {
            throw new Error(`[ContextBudgetManager] Source not found: ${id}`);
        }

        const updated = { ...existing, ...updates };

        // Recalculate tokens if content changed
        if (updates.content && !updates.tokens) {
            updated.tokens = this.estimateTokens(updates.content);
        }

        this.sources.set(id, updated);
    }

    /**
     * Remove a source.
     */
    removeSource(id: string): boolean {
        return this.sources.delete(id);
    }

    /**
     * Get a source by ID.
     */
    getSource(id: string): ContextSource | undefined {
        return this.sources.get(id);
    }

    /**
     * Get all sources.
     */
    getAllSources(): ContextSource[] {
        return Array.from(this.sources.values());
    }

    /**
     * Clear all sources.
     */
    clear(): void {
        this.sources.clear();
    }

    // ============================================================================
    // Token Estimation
    // ============================================================================

    /**
     * Estimate tokens for a string.
     */
    estimateTokens(content: string): number {
        if (!this.config.estimateTokens) {
            throw new Error('[ContextBudgetManager] Token estimation disabled, provide explicit tokens');
        }
        return Math.ceil(content.length / this.config.charsPerToken);
    }

    /**
     * Get total tokens across all sources.
     */
    getTotalTokens(): number {
        let total = 0;
        for (const source of Array.from(this.sources.values())) {
            total += source.tokens ?? 0;
        }
        return total;
    }

    /**
     * Get available tokens (budget minus current usage).
     */
    getAvailableTokens(): number {
        const effectiveBudget = this.config.maxTokens - this.config.outputReserve;
        return Math.max(0, effectiveBudget - this.getTotalTokens());
    }

    /**
     * Check if we're over budget.
     */
    isOverBudget(): boolean {
        return this.getAvailableTokens() <= 0;
    }

    /**
     * Get token breakdown.
     */
    getTokenBreakdown(): TokenBreakdown {
        const byType: Record<ContextSourceType, number> = {} as Record<ContextSourceType, number>;
        const byId: Record<string, number> = {};
        let total = 0;

        for (const source of Array.from(this.sources.values())) {
            const tokens = source.tokens ?? 0;
            total += tokens;
            byId[source.id] = tokens;
            byType[source.type] = (byType[source.type] ?? 0) + tokens;
        }

        return { byType, byId, total };
    }

    // ============================================================================
    // Optimization
    // ============================================================================

    /**
     * Optimize context to fit within budget.
     */
    optimize(): OptimizedContext {
        const effectiveBudget = this.config.maxTokens - this.config.outputReserve;
        const allSources = this.getAllSources();

        // Separate required and optional sources
        const required = allSources.filter((s) => s.required);
        const optional = allSources.filter((s) => !s.required);

        // Calculate required token usage
        const requiredTokens = required.reduce((sum, s) => sum + (s.tokens ?? 0), 0);

        if (requiredTokens > effectiveBudget) {
            console.warn('[ContextBudgetManager] Required sources exceed budget!');
        }

        // Available space for optional sources
        const availableForOptional = Math.max(0, effectiveBudget - requiredTokens);

        // Sort optional sources by strategy
        const sorted = this.sortByStrategy(optional);

        // Greedily include sources until budget exhausted
        const included: ContextSource[] = [...required];
        const pruned: ContextSource[] = [];
        let usedTokens = requiredTokens;

        for (const source of sorted) {
            const tokens = source.tokens ?? 0;
            if (usedTokens + tokens <= effectiveBudget) {
                included.push(source);
                usedTokens += tokens;
            } else {
                pruned.push(source);
            }
        }

        // Build combined content
        const orderedIncluded = this.orderForOutput(included);
        const content = orderedIncluded.map((s) => s.content).join('\n\n');

        return {
            content,
            includedSources: orderedIncluded,
            prunedSources: pruned,
            totalTokens: usedTokens,
            budget: effectiveBudget,
            utilizationPercent: (usedTokens / effectiveBudget) * 100,
        };
    }

    /**
     * Sort sources by pruning strategy (lowest priority first for removal).
     */
    private sortByStrategy(sources: ContextSource[]): ContextSource[] {
        const sorted = [...sources];

        switch (this.config.strategy) {
            case 'priority':
                // Highest priority first (keep these)
                sorted.sort((a, b) => b.priority - a.priority);
                break;

            case 'recency':
                // Most recent first (keep these)
                sorted.sort((a, b) => b.addedAt - a.addedAt);
                break;

            case 'size':
                // Smallest first (keep these to maximize count)
                sorted.sort((a, b) => (a.tokens ?? 0) - (b.tokens ?? 0));
                break;

            case 'type':
                // Order by type priority
                const typeOrder = this.config.typeOrder || DEFAULT_CONFIG.typeOrder!;
                sorted.sort((a, b) => {
                    const aIndex = typeOrder.indexOf(a.type);
                    const bIndex = typeOrder.indexOf(b.type);
                    return aIndex - bIndex;
                });
                break;

            case 'smart':
            default:
                // Combine priority, recency, and size
                sorted.sort((a, b) => {
                    // Normalize factors to 0-1 range
                    const maxPriority = Math.max(...sources.map((s) => s.priority));
                    const maxAge = Date.now() - Math.min(...sources.map((s) => s.addedAt));
                    const maxSize = Math.max(...sources.map((s) => s.tokens ?? 1));

                    const aPriority = a.priority / maxPriority;
                    const bPriority = b.priority / maxPriority;

                    const aRecency = maxAge > 0 ? (Date.now() - a.addedAt) / maxAge : 0;
                    const bRecency = maxAge > 0 ? (Date.now() - b.addedAt) / maxAge : 0;

                    const aSize = (a.tokens ?? 1) / maxSize;
                    const bSize = (b.tokens ?? 1) / maxSize;

                    // Score: higher priority + more recent + smaller = better
                    const aScore = aPriority * 0.5 + (1 - aRecency) * 0.3 + (1 - aSize) * 0.2;
                    const bScore = bPriority * 0.5 + (1 - bRecency) * 0.3 + (1 - bSize) * 0.2;

                    return bScore - aScore;
                });
                break;
        }

        return sorted;
    }

    /**
     * Order sources for output (e.g., system prompt first).
     */
    private orderForOutput(sources: ContextSource[]): ContextSource[] {
        const typeOrder = this.config.typeOrder || DEFAULT_CONFIG.typeOrder!;
        return [...sources].sort((a, b) => {
            const aIndex = typeOrder.indexOf(a.type);
            const bIndex = typeOrder.indexOf(b.type);
            if (aIndex !== bIndex) return aIndex - bIndex;
            // Within same type, order by priority
            return b.priority - a.priority;
        });
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * Create a summary for logging.
     */
    createSummary(): string {
        const breakdown = this.getTokenBreakdown();
        const effectiveBudget = this.config.maxTokens - this.config.outputReserve;
        const utilization = (breakdown.total / effectiveBudget) * 100;

        const lines = [
            `Context Budget: ${breakdown.total}/${effectiveBudget} tokens (${utilization.toFixed(1)}%)`,
            `Sources: ${this.sources.size}`,
            'Breakdown:',
        ];

        for (const [type, tokens] of Object.entries(breakdown.byType)) {
            lines.push(`  ${type}: ${tokens} tokens`);
        }

        if (this.isOverBudget()) {
            lines.push('⚠️ OVER BUDGET - optimization required');
        }

        return lines.join('\n');
    }

    /**
     * Get configuration.
     */
    getConfig(): ContextBudgetConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    updateConfig(updates: Partial<ContextBudgetConfig>): void {
        this.config = { ...this.config, ...updates };
    }
}
