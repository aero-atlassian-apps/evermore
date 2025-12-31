/**
 * Agent Memory Port - Interface for Memory Management
 * 
 * Follows Dependency Inversion Principle (DIP).
 * GenerateChapterUseCase depends on this abstraction, not the concrete AgentMemoryManager.
 */

import { MemoryEntry, MemoryQuery } from '../agent/memory/AgentMemory';

export interface AgentMemoryPort {
    /**
     * Store a new memory.
     */
    store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount' | 'decayFactor' | 'correctnessConfidence'>): Promise<MemoryEntry>;

    /**
     * Retrieve a memory by ID.
     */
    get(id: string): MemoryEntry | undefined;

    /**
     * Query memories.
     */
    query(options: MemoryQuery): Promise<MemoryEntry[]>;

    /**
     * Get working memory contents.
     */
    getWorkingMemory(): MemoryEntry[];
}

export type AgentMemoryFactory = (userId: string) => AgentMemoryPort;
