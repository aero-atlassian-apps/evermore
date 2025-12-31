/**
 * Agent Memory System - Persistent learning and context across sessions.
 * 
 * Implements an episodic and semantic memory system for agents:
 * - Short-term memory (current session)
 * - Long-term memory (cross-session persistence)
 * - Semantic memory (learned facts and patterns)
 * - Episodic memory (specific events/interactions)
 * - Working memory (active context)
 * 
 * @module AgentMemory
 */

// ============================================================================
// Imports
// ============================================================================

import { EmbeddingPort } from '../../ports/EmbeddingPort';
import { VectorStorePort } from '../../ports/VectorStorePort';
import { AgentMemoryPort } from '../../ports/AgentMemoryPort';

// ============================================================================
// Types
// ============================================================================

/**
 * Memory types.
 */
export enum MemoryType {
    /** Short-term session memory */
    SHORT_TERM = 'SHORT_TERM',
    /** Long-term persistent memory */
    LONG_TERM = 'LONG_TERM',
    /** Semantic/factual memory */
    SEMANTIC = 'SEMANTIC',
    /** Episodic/event memory */
    EPISODIC = 'EPISODIC',
    /** Active working memory */
    WORKING = 'WORKING',
}

/**
 * Memory importance levels.
 */
export enum MemoryImportance {
    CRITICAL = 5,
    HIGH = 4,
    MEDIUM = 3,
    LOW = 2,
    TRIVIAL = 1,
}

/**
 * A single memory entry.
 */
export interface MemoryEntry {
    /** Unique ID */
    id: string;
    /** Memory type */
    type: MemoryType;
    /** Content */
    content: string;
    /** Structured data */
    data?: Record<string, unknown>;
    /** Importance score (1-5) */
    importance: MemoryImportance;
    /** When it was created */
    createdAt: number;
    /** When it was last accessed */
    lastAccessedAt: number;
    /** Access count */
    accessCount: number;
    /** Decay factor (0-1, where 1 = fresh) */
    decayFactor: number;
    /** Related memory IDs */
    relatedMemories: string[];
    /** Tags for categorization */
    tags: string[];
    /** Source (agent ID, tool, user, etc.) */
    source: string;
    /** Context in which memory was formed */
    context?: MemoryContext;
    /** Embedding vector for semantic search */
    embedding?: number[];
    /** Correctness confidence (0-1, reduced on user corrections) - M2 hardening */
    correctnessConfidence: number;
    /** ID of memory that supersedes this one (for correction chains) - A2 hardening */
    supersededBy?: string;
}

/**
 * Context when memory was formed.
 */
export interface MemoryContext {
    /** Session ID */
    sessionId: string;
    /** User ID */
    userId: string;
    /** Goal at the time */
    goal?: string;
    /** Step that generated this memory */
    stepId?: string;
    /** Emotional tone */
    emotionalTone?: string;
}

/**
 * Memory query options.
 */
export interface MemoryQuery {
    /** Text query for semantic search */
    query?: string;
    /** Filter by type */
    types?: MemoryType[];
    /** Filter by tags */
    tags?: string[];
    /** Minimum importance */
    minImportance?: MemoryImportance;
    /** Minimum decay factor */
    minDecay?: number;
    /** Time range */
    timeRange?: {
        start: number;
        end: number;
    };
    /** Maximum results */
    limit?: number;
    /** Whether to include related memories */
    includeRelated?: boolean;
}

/**
 * Memory consolidation result.
 */
export interface ConsolidationResult {
    /** Memories promoted to long-term */
    promoted: string[];
    /** Memories merged */
    merged: string[];
    /** Memories forgotten (decayed away) */
    forgotten: string[];
    /** Newly formed associations */
    associations: Array<{ from: string; to: string; strength: number }>;
}

/**
 * Memory statistics.
 */
export interface MemoryStats {
    /** Count by type */
    countByType: Record<MemoryType, number>;
    /** Average importance */
    averageImportance: number;
    /** Average decay */
    averageDecay: number;
    /** Total memories */
    totalCount: number;
    /** Old memories (decay < 0.3) */
    decayedCount: number;
}

// ============================================================================
// Agent Memory Manager
// ============================================================================

/**
 * Manages agent memory across sessions.
 * 
 * Usage:
 * ```typescript
 * const memory = new AgentMemoryManager(userId);
 * 
 * // Store a memory
 * memory.store({
 *   type: MemoryType.EPISODIC,
 *   content: 'User mentioned their grandmother made apple pie',
 *   importance: MemoryImportance.HIGH,
 *   tags: ['family', 'food', 'grandmother'],
 *   source: 'conversation-agent',
 * });
 * 
 * // Query memories
 * const relevant = await memory.query({
 *   query: 'grandmother cooking',
 *   types: [MemoryType.EPISODIC, MemoryType.SEMANTIC],
 *   limit: 5,
 * });
 * 
 * // Consolidate (run periodically)
 * const result = await memory.consolidate();
 * ```
 */
export class AgentMemoryManager implements AgentMemoryPort {
    private userId: string;
    private memories: Map<string, MemoryEntry> = new Map();
    private workingMemory: MemoryEntry[] = [];
    private consolidationInterval?: NodeJS.Timeout;
    private vectorStore?: VectorStorePort;
    private embeddingPort?: EmbeddingPort;

    /** Decay rate per hour */
    private readonly DECAY_RATE = 0.05;
    /** Working memory capacity (max items) */
    private readonly WORKING_MEMORY_CAPACITY = 10;
    /** Working memory size limit in bytes (prevents adversarial large inputs) */
    private readonly WORKING_MEMORY_MAX_BYTES = 50000; // ~50KB
    /** Current working memory size in bytes */
    private workingMemoryBytes = 0;
    /** Forget threshold */
    private readonly FORGET_THRESHOLD = 0.1;
    /** Maximum related memories to prevent unbounded growth - M1 hardening */
    private readonly MAX_RELATED_MEMORIES = 20;
    /** Maximum age in days before decay ceiling applies - M3 hardening */
    private readonly DECAY_CEILING_AGE_DAYS = 30;
    /** Maximum decay factor for old memories - M3 hardening */
    private readonly DECAY_CEILING = 0.8;

    constructor(userId: string, vectorStore?: VectorStorePort, embeddingPort?: EmbeddingPort) {
        this.userId = userId;
        this.vectorStore = vectorStore;
        this.embeddingPort = embeddingPort;
    }

    // ============================================================================
    // Core Operations
    // ============================================================================

    /**
     * Store a new memory.
     */
    async store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount' | 'decayFactor' | 'correctnessConfidence'>): Promise<MemoryEntry> {
        const now = Date.now();
        const memory: MemoryEntry = {
            ...entry,
            id: `mem-${now}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: now,
            lastAccessedAt: now,
            accessCount: 1,
            decayFactor: 1.0,
            correctnessConfidence: 1.0, // Default confidence for new memories
            relatedMemories: entry.relatedMemories || [],
            tags: entry.tags || [],
        };

        // Generate embedding if port is available
        if (this.embeddingPort) {
            try {
                memory.embedding = await this.embeddingPort.generateEmbedding(memory.content);
            } catch (e) {
                console.warn('[AgentMemory] Failed to generate embedding for memory:', e);
            }
        }

        this.memories.set(memory.id, memory);

        // Persist to vector store if available and important
        if (this.vectorStore && memory.embedding && memory.importance >= MemoryImportance.MEDIUM) {
            try {
                await this.vectorStore.upsert(memory.id, memory.embedding, {
                    userId: this.userId,
                    type: memory.type,
                    tags: memory.tags,
                    importance: memory.importance,
                    content: memory.content,
                });
            } catch (e) {
                console.warn('[AgentMemory] Failed to upsert to vector store:', e);
            }
        }

        // Update working memory if important enough
        if (memory.importance >= MemoryImportance.MEDIUM) {
            this.addToWorkingMemory(memory);
        }

        // Find and link related memories
        this.linkRelatedMemories(memory);

        return memory;
    }

    /**
     * Retrieve a memory by ID.
     */
    get(id: string): MemoryEntry | undefined {
        const memory = this.memories.get(id);
        if (memory) {
            // Update access stats
            memory.lastAccessedAt = Date.now();
            memory.accessCount++;
            // Refresh decay on access with age-based ceiling - M3 hardening
            const ageMs = Date.now() - memory.createdAt;
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            const maxDecay = ageDays > this.DECAY_CEILING_AGE_DAYS ? this.DECAY_CEILING : 1.0;
            memory.decayFactor = Math.min(maxDecay, memory.decayFactor + 0.1);
        }
        return memory;
    }

    /**
     * Query memories.
     */
    async query(options: MemoryQuery): Promise<MemoryEntry[]> {
        let results = Array.from(this.memories.values());

        // Filter by type
        if (options.types && options.types.length > 0) {
            results = results.filter((m) => options.types!.includes(m.type));
        }

        // Filter by tags
        if (options.tags && options.tags.length > 0) {
            results = results.filter((m) => options.tags!.some((tag) => m.tags.includes(tag)));
        }

        // Filter by importance
        if (options.minImportance) {
            results = results.filter((m) => m.importance >= options.minImportance!);
        }

        // Filter by decay
        if (options.minDecay) {
            results = results.filter((m) => m.decayFactor >= options.minDecay!);
        }

        // Filter by time range
        if (options.timeRange) {
            results = results.filter(
                (m) => m.createdAt >= options.timeRange!.start && m.createdAt <= options.timeRange!.end
            );
        }

        // Semantic search (vector-based if available)
        if (options.query) {
            if (this.embeddingPort && this.vectorStore) {
                try {
                    const queryEmbedding = await this.embeddingPort.generateEmbedding(options.query);
                    const vectorMatches = await this.vectorStore.query(queryEmbedding, options.limit || 10, { userId: this.userId });

                    // Merge vector search results with current in-memory findings
                    for (const match of vectorMatches) {
                        if (!this.memories.has(match.id)) {
                            // If not in memory (cross-session), we might want to fetch or hydrate it
                            // For now, we simulate hydration from metadata if available
                            if (match.metadata && match.metadata.content) {
                                // M4 hardening: Don't assign query embedding to hydrated memory
                                // Re-embed the actual content asynchronously if embedding port available
                                let hydratedEmbedding: number[] | undefined = undefined;
                                if (this.embeddingPort) {
                                    try {
                                        hydratedEmbedding = await this.embeddingPort.generateEmbedding(match.metadata.content);
                                    } catch {
                                        // Leave undefined if re-embedding fails
                                    }
                                }
                                const hydrated: MemoryEntry = {
                                    id: match.id,
                                    content: match.metadata.content,
                                    type: (match.metadata.type as MemoryType) || MemoryType.LONG_TERM,
                                    importance: (match.metadata.importance as MemoryImportance) || MemoryImportance.MEDIUM,
                                    tags: (match.metadata.tags as string[]) || [],
                                    createdAt: Date.now(), // Approximate
                                    lastAccessedAt: Date.now(),
                                    accessCount: 1,
                                    decayFactor: 1.0,
                                    relatedMemories: [],
                                    source: 'vector-store',
                                    embedding: hydratedEmbedding, // M4 fix: use correct content embedding
                                    correctnessConfidence: 1.0, // Default confidence
                                };
                                this.memories.set(hydrated.id, hydrated);
                                results.push(hydrated);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[AgentMemory] Vector search failed, falling back to substring:', e);
                }
            }

            // Substring fallback/supplement
            const queryLower = options.query.toLowerCase();
            results = results.filter(
                (m) =>
                    m.content.toLowerCase().includes(queryLower) ||
                    m.tags.some((t) => t.toLowerCase().includes(queryLower))
            );
        }

        // Sort by relevance (importance * decay * recency)
        results.sort((a, b) => {
            const scoreA = this.calculateRelevanceScore(a, options.query);
            const scoreB = this.calculateRelevanceScore(b, options.query);
            return scoreB - scoreA;
        });

        // Limit results
        if (options.limit) {
            results = results.slice(0, options.limit);
        }

        // Include related memories
        if (options.includeRelated) {
            const relatedIds = new Set<string>();
            for (const mem of results) {
                for (const relId of mem.relatedMemories) {
                    if (!results.some((r) => r.id === relId)) {
                        relatedIds.add(relId);
                    }
                }
            }
            for (const relId of relatedIds) {
                const related = this.memories.get(relId);
                if (related && results.length < (options.limit || 20)) {
                    results.push(related);
                }
            }
        }

        // Update access stats for retrieved memories
        for (const mem of results) {
            mem.lastAccessedAt = Date.now();
            mem.accessCount++;
        }

        return results;
    }

    /**
     * Calculate relevance score.
     */
    private calculateRelevanceScore(memory: MemoryEntry, query?: string): number {
        const now = Date.now();
        const ageHours = (now - memory.createdAt) / (1000 * 60 * 60);
        const recencyScore = Math.exp(-ageHours / 24); // Decay over 24 hours

        let score = memory.importance * memory.decayFactor * recencyScore * (1 + Math.log1p(memory.accessCount));

        // Boost for query match
        if (query) {
            const queryLower = query.toLowerCase();
            if (memory.content.toLowerCase().includes(queryLower)) {
                score *= 2;
            }
            for (const tag of memory.tags) {
                if (tag.toLowerCase().includes(queryLower)) {
                    score *= 1.5;
                }
            }
        }

        return score;
    }

    // ============================================================================
    // Working Memory
    // ============================================================================

    /**
     * Add to working memory with size limits.
     */
    private addToWorkingMemory(memory: MemoryEntry): void {
        const memorySize = this.estimateMemoryBytes(memory);

        // Check if this single memory exceeds max (safety guard)
        if (memorySize > this.WORKING_MEMORY_MAX_BYTES) {
            console.warn(`[AgentMemory] Memory entry ${memory.id} exceeds max size (${memorySize} bytes), truncating`);
            // Truncate content to fit within limits
            const maxContentLength = Math.floor(this.WORKING_MEMORY_MAX_BYTES * 0.8); // 80% for content
            memory.content = memory.content.substring(0, maxContentLength) + '... [truncated]';
        }

        // Remove if already present and adjust byte count
        const existing = this.workingMemory.find((m) => m.id === memory.id);
        if (existing) {
            this.workingMemoryBytes -= this.estimateMemoryBytes(existing);
            this.workingMemory = this.workingMemory.filter((m) => m.id !== memory.id);
        }

        // Add to front
        this.workingMemory.unshift(memory);
        this.workingMemoryBytes += this.estimateMemoryBytes(memory);

        // Enforce capacity (item count)
        while (this.workingMemory.length > this.WORKING_MEMORY_CAPACITY) {
            const removed = this.workingMemory.pop();
            if (removed) {
                this.workingMemoryBytes -= this.estimateMemoryBytes(removed);
            }
        }

        // Enforce byte limit (evict oldest if over limit)
        while (this.workingMemoryBytes > this.WORKING_MEMORY_MAX_BYTES && this.workingMemory.length > 0) {
            const removed = this.workingMemory.pop();
            if (removed) {
                this.workingMemoryBytes -= this.estimateMemoryBytes(removed);
                console.warn(`[AgentMemory] Evicted memory ${removed.id} to enforce byte limit`);
            }
        }
    }

    /**
     * Estimate memory entry size in bytes.
     */
    private estimateMemoryBytes(memory: MemoryEntry): number {
        // Approximate: content + tags + some overhead
        const contentBytes = new TextEncoder().encode(memory.content).length;
        const tagsBytes = memory.tags.reduce((sum, tag) => sum + tag.length, 0);
        const overheadBytes = 200; // Fixed overhead for other fields
        return contentBytes + tagsBytes + overheadBytes;
    }

    /**
     * Get working memory contents.
     */
    getWorkingMemory(): MemoryEntry[] {
        return [...this.workingMemory];
    }

    /**
     * Clear working memory.
     */
    clearWorkingMemory(): void {
        this.workingMemory = [];
        this.workingMemoryBytes = 0;
    }

    /**
     * Get working memory as context string.
     */
    getWorkingMemoryContext(): string {
        if (this.workingMemory.length === 0) return '';

        return (
            'ACTIVE CONTEXT:\n' +
            this.workingMemory.map((m) => `- ${m.content} [${m.tags.join(', ')}]`).join('\n')
        );
    }

    // ============================================================================
    // Memory Relationships
    // ============================================================================

    /**
     * Link related memories based on content similarity.
     */
    private linkRelatedMemories(newMemory: MemoryEntry): void {
        const newTags = new Set(newMemory.tags);
        const newWords = new Set(newMemory.content.toLowerCase().split(/\s+/));

        for (const [id, existing] of this.memories) {
            if (id === newMemory.id) continue;

            // Calculate similarity based on tags and content overlap
            let similarity = 0;

            // Tag overlap
            for (const tag of existing.tags) {
                if (newTags.has(tag)) similarity += 2;
            }

            // Word overlap (simple)
            const existingWords = new Set(existing.content.toLowerCase().split(/\s+/));
            for (const word of existingWords) {
                if (word.length > 3 && newWords.has(word)) similarity += 1;
            }

            // Link if similarity is high enough, with M1 cap on relatedMemories
            if (similarity >= 3) {
                // M1 hardening: Cap relatedMemories to prevent unbounded growth
                if (!newMemory.relatedMemories.includes(id) &&
                    newMemory.relatedMemories.length < this.MAX_RELATED_MEMORIES) {
                    newMemory.relatedMemories.push(id);
                }
                if (!existing.relatedMemories.includes(newMemory.id) &&
                    existing.relatedMemories.length < this.MAX_RELATED_MEMORIES) {
                    existing.relatedMemories.push(newMemory.id);
                }
            }
        }
    }

    // ============================================================================
    // Memory Consolidation
    // ============================================================================

    /**
     * Consolidate memories: promote, merge, and forget.
     */
    async consolidate(): Promise<ConsolidationResult> {
        const now = Date.now();
        const result: ConsolidationResult = {
            promoted: [],
            merged: [],
            forgotten: [],
            associations: [],
        };

        // Apply decay
        for (const memory of this.memories.values()) {
            const ageHours = (now - memory.lastAccessedAt) / (1000 * 60 * 60);
            memory.decayFactor = Math.max(0, memory.decayFactor - ageHours * this.DECAY_RATE);
        }

        // Promote important short-term memories to long-term
        for (const memory of this.memories.values()) {
            if (
                memory.type === MemoryType.SHORT_TERM &&
                memory.importance >= MemoryImportance.HIGH &&
                memory.accessCount >= 2
            ) {
                memory.type = MemoryType.LONG_TERM;
                result.promoted.push(memory.id);
            }
        }

        // Forget low-value, highly-decayed memories
        const toForget: string[] = [];
        for (const memory of this.memories.values()) {
            if (
                memory.decayFactor < this.FORGET_THRESHOLD &&
                memory.importance <= MemoryImportance.LOW &&
                memory.type !== MemoryType.SEMANTIC // Never forget semantic memories
            ) {
                toForget.push(memory.id);
            }
        }

        for (const id of toForget) {
            this.memories.delete(id);
            result.forgotten.push(id);
        }

        // Build associations between frequently accessed memories
        const recentlyAccessed = Array.from(this.memories.values())
            .filter((m) => now - m.lastAccessedAt < 3600000) // Last hour
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, 20);

        for (let i = 0; i < recentlyAccessed.length; i++) {
            for (let j = i + 1; j < recentlyAccessed.length; j++) {
                const m1 = recentlyAccessed[i];
                const m2 = recentlyAccessed[j];
                if (!m1.relatedMemories.includes(m2.id)) {
                    m1.relatedMemories.push(m2.id);
                    m2.relatedMemories.push(m1.id);
                    result.associations.push({
                        from: m1.id,
                        to: m2.id,
                        strength: (m1.accessCount + m2.accessCount) / 10,
                    });
                }
            }
        }

        return result;
    }

    /**
     * Start automatic consolidation.
     */
    startAutoConsolidation(intervalMs: number = 300000): void {
        this.consolidationInterval = setInterval(() => {
            this.consolidate().catch((e) => console.error('[AgentMemory] Consolidation failed:', e));
        }, intervalMs);
    }

    /**
     * Stop automatic consolidation.
     */
    stopAutoConsolidation(): void {
        if (this.consolidationInterval) {
            clearInterval(this.consolidationInterval);
            this.consolidationInterval = undefined;
        }
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * Get memory statistics.
     */
    getStats(): MemoryStats {
        const memories = Array.from(this.memories.values());
        const countByType: Record<MemoryType, number> = {
            [MemoryType.SHORT_TERM]: 0,
            [MemoryType.LONG_TERM]: 0,
            [MemoryType.SEMANTIC]: 0,
            [MemoryType.EPISODIC]: 0,
            [MemoryType.WORKING]: 0,
        };

        let totalImportance = 0;
        let totalDecay = 0;
        let decayedCount = 0;

        for (const mem of memories) {
            countByType[mem.type]++;
            totalImportance += mem.importance;
            totalDecay += mem.decayFactor;
            if (mem.decayFactor < 0.3) decayedCount++;
        }

        return {
            countByType,
            averageImportance: memories.length > 0 ? totalImportance / memories.length : 0,
            averageDecay: memories.length > 0 ? totalDecay / memories.length : 0,
            totalCount: memories.length,
            decayedCount,
        };
    }

    /**
     * Export all memories.
     */
    export(): MemoryEntry[] {
        return Array.from(this.memories.values());
    }

    /**
     * Import memories.
     */
    import(memories: MemoryEntry[]): void {
        for (const mem of memories) {
            this.memories.set(mem.id, mem);
        }
    }

    /**
     * Clear all memories.
     */
    clear(): void {
        this.memories.clear();
        this.workingMemory = [];
    }
}
