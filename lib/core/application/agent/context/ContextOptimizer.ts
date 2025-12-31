import { ContextSource, ContextSourceType } from './ContextBudgetManager';

/**
 * Context Optimizer - Logic for context reuse and caching stability.
 */
export interface StabilizationResult {
    /** The index up to which the context is stable */
    stableIndex: number;
    /** The hash of the stable prefix */
    stableHash: string;
    /** Source IDs that are stable */
    stableSourceIds: string[];
}

export class ContextOptimizer {
    /**
     * Identify the stable prefix of context sources.
     * Useful for LLM context caching (like Gemini 1.5 Pro).
     */
    static identifyStablePrefix(sources: ContextSource[]): StabilizationResult {
        let stableIndex = -1;
        let stableHash = '';
        const stableSourceIds: string[] = [];

        // Rules for stability:
        // 1. System prompt is always stable
        // 2. Instructions are usually stable
        // 3. Examples are usually stable
        // 4. Conversation history is stable if it's the SAME history as before (incremental)

        // For simplicity, we assume sources are ordered for output.
        // We find the first source that is "volatile".
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];

            // Volatile types: observations, tool_results (often change every step)
            if (source.type === 'observations' || source.type === 'tool_results') {
                break;
            }

            stableIndex = i;
            stableSourceIds.push(source.id);
            stableHash += `|${source.id}:${this.hashContent(source.content)}`;
        }

        return {
            stableIndex,
            stableHash,
            stableSourceIds,
        };
    }

    /**
     * Simple hash function for content stability checking.
     */
    private static hashContent(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    /**
     * Suggest pruning for non-stable items if budget is tight.
     */
    static suggestPruning(sources: ContextSource[], budget: number): string[] {
        // Implementation logic to suggest which non-stable items to prune
        // to keep the stable prefix as large as possible.
        return [];
    }
}
