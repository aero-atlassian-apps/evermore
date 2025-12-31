/**
 * Context Manager - Manages the LLM context window and token budget.
 * 
 * Responsibilities:
 * - Enforce strict token limits (Budgeting)
 * - Implement sliding window for conversation history
 * - Prune irrelevant context (Semantic pruning)
 * - Prioritize system prompts and recent observations
 * 
 * @module ContextManager
 */

import { AgentContext } from '../types';

export interface ContextConfig {
    maxTotalTokens: number;
    maxHistoryTokens: number;
    keepSystemPrompt: boolean;
    prioritizeRecent: boolean;
}

export interface ManagedContext {
    systemPrompt: string;
    history: string[]; // Simplification for now, could be Message[]
    relevantMemories: string[];
    totalTokens: number;
    isTruncated: boolean;
}

/**
 * Manages context construction to stay within limits.
 * 
 * Strategy:
 * 1. Always keep System Prompt (highest priority)
 * 2. Keep standard instructions/tools definitions
 * 3. Keep most recent N messages (Short-term memory)
 * 4. Fill remaining budget with relevant long-term memories/facts
 * 5. Aggressively summarize or drop middle history if needed
 */
export class ContextManager {
    constructor(private config: ContextConfig = {
        maxTotalTokens: 8000,
        maxHistoryTokens: 4000,
        keepSystemPrompt: true,
        prioritizeRecent: true
    }) { }

    /**
     * Construct a prompt context that fits within the budget.
     */
    public async buildContext(
        systemPrompt: string,
        history: string[],
        memories: string[],
        currentTask?: string
    ): Promise<ManagedContext> {
        // 1. Estimate base tokens (System + Task)
        const baseTokens = this.estimateTokens(systemPrompt) + (currentTask ? this.estimateTokens(currentTask) : 0);
        const availableForHistory = Math.max(0, this.config.maxTotalTokens - baseTokens);

        // 2. Select Memories (up to 25% of available)
        const memoryBudget = Math.floor(availableForHistory * 0.25);
        const selectedMemories = this.selectMemories(memories, memoryBudget);
        const memoryTokens = this.estimateTokens(selectedMemories.join('\n'));

        // 3. Select History (remaining)
        let historyBudget = availableForHistory - memoryTokens;
        if (historyBudget > this.config.maxHistoryTokens) {
            historyBudget = this.config.maxHistoryTokens;
        }

        const { selectedHistory, isTruncated } = this.processHistory(history, historyBudget);

        const totalTokens = baseTokens + memoryTokens + this.estimateTokens(selectedHistory.join('\n'));

        return {
            systemPrompt,
            history: selectedHistory,
            relevantMemories: selectedMemories,
            totalTokens,
            isTruncated
        };
    }

    /**
     * Simple whitespace-based token estimation.
     * In production, use a real tokenizer (e.g., tiktoken) matching the model.
     */
    private estimateTokens(text: string): number {
        if (!text) return 0;
        // Rough estimate: 1 token ~= 4 chars or 0.75 words
        // A more conservative estimate for safety: length / 3
        return Math.ceil(text.length / 3.5);
    }

    /**
     * Selects relevant memories within budget.
     * @todo Implement semantic relevance filtering using embeddings
     */
    private selectMemories(memories: string[], budget: number): string[] {
        const selected: string[] = [];
        let currentTokens = 0;

        for (const mem of memories) {
            const tokens = this.estimateTokens(mem);
            if (currentTokens + tokens <= budget) {
                selected.push(mem);
                currentTokens += tokens;
            } else {
                break; // Stop if full
            }
        }
        return selected;
    }

    /**
     * Slides the window over history to fit budget.
     * Keeps most recent messages.
     */
    private processHistory(history: string[], budget: number): { selectedHistory: string[], isTruncated: boolean } {
        let currentTokens = 0;
        const selected: string[] = [];
        let isTruncated = false;

        // Iterate backwards from most recent
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            const tokens = this.estimateTokens(msg);

            if (currentTokens + tokens <= budget) {
                selected.unshift(msg); // Add to front to maintain order
                currentTokens += tokens;
            } else {
                isTruncated = true;
                break; // Stop, older messages are dropped
            }
        }

        return { selectedHistory: selected, isTruncated };
    }
}
