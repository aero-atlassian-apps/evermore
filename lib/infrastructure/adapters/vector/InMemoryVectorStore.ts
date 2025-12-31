/**
 * In-Memory Vector Store - Local development vector database.
 * 
 * A full-featured in-memory vector store with real cosine similarity search.
 * Perfect for local development when Pinecone is not available.
 * 
 * Features:
 * - Real cosine similarity search
 * - Metadata filtering
 * - Per-user isolation
 * - No external dependencies
 * 
 * Note: Data is lost on restart. For production, use Pinecone.
 * 
 * @module InMemoryVectorStore
 */

import { VectorStorePort, VectorMatch } from '../../../core/application/ports/VectorStorePort';

interface StoredVector {
    id: string;
    vector: number[];
    metadata: Record<string, any>;
    timestamp: number;
}

export class InMemoryVectorStore implements VectorStorePort {
    private vectors: Map<string, StoredVector> = new Map();
    private readonly maxVectors: number;

    constructor(maxVectors: number = 10000) {
        this.maxVectors = maxVectors;
        console.log(`[InMemoryVectorStore] Initialized (max ${maxVectors} vectors)`);
    }

    /**
     * Store a vector with metadata.
     */
    async upsert(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
        // Enforce max size with LRU eviction
        if (this.vectors.size >= this.maxVectors && !this.vectors.has(id)) {
            const oldest = this.findOldestVector();
            if (oldest) {
                this.vectors.delete(oldest);
                console.log(`[InMemoryVectorStore] Evicted oldest vector: ${oldest}`);
            }
        }

        this.vectors.set(id, {
            id,
            vector,
            metadata: { ...metadata, timestamp: new Date().toISOString() },
            timestamp: Date.now(),
        });

        console.log(`[InMemoryVectorStore] Upserted vector ${id} (total: ${this.vectors.size})`);
    }

    /**
     * Query for similar vectors using cosine similarity.
     */
    async query(
        queryVector: number[],
        topK: number,
        filter?: Record<string, any>
    ): Promise<VectorMatch[]> {
        const results: Array<{ id: string; score: number; metadata: Record<string, any> }> = [];

        for (const stored of this.vectors.values()) {
            // Apply metadata filter if provided
            if (filter && !this.matchesFilter(stored.metadata, filter)) {
                continue;
            }

            // Calculate cosine similarity
            const score = this.cosineSimilarity(queryVector, stored.vector);
            results.push({
                id: stored.id,
                score,
                metadata: stored.metadata,
            });
        }

        // Sort by score descending and take topK
        results.sort((a, b) => b.score - a.score);
        const topResults = results.slice(0, topK);

        console.log(`[InMemoryVectorStore] Query returned ${topResults.length} results (from ${this.vectors.size} vectors)`);
        return topResults;
    }

    /**
     * Delete a vector by ID.
     */
    async delete(id: string): Promise<void> {
        const deleted = this.vectors.delete(id);
        console.log(`[InMemoryVectorStore] ${deleted ? 'Deleted' : 'Not found'} vector ${id}`);
    }

    /**
     * Clear all vectors for a specific user.
     */
    async clear(userId: string): Promise<void> {
        let count = 0;
        for (const [id, stored] of this.vectors.entries()) {
            if (stored.metadata.userId === userId) {
                this.vectors.delete(id);
                count++;
            }
        }
        console.log(`[InMemoryVectorStore] Cleared ${count} vectors for user ${userId}`);
    }

    /**
     * Get total vector count (for debugging).
     */
    getCount(): number {
        return this.vectors.size;
    }

    /**
     * Clear all vectors (for testing).
     */
    clearAll(): void {
        this.vectors.clear();
        console.log('[InMemoryVectorStore] Cleared all vectors');
    }

    // --- Private Methods ---

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            console.warn(`[InMemoryVectorStore] Vector dimension mismatch: ${a.length} vs ${b.length}`);
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        if (magnitude === 0) return 0;

        return dotProduct / magnitude;
    }

    private matchesFilter(metadata: Record<string, any>, filter: Record<string, any>): boolean {
        for (const [key, value] of Object.entries(filter)) {
            if (metadata[key] !== value) {
                return false;
            }
        }
        return true;
    }

    private findOldestVector(): string | null {
        let oldest: { id: string; timestamp: number } | null = null;

        for (const stored of this.vectors.values()) {
            if (!oldest || stored.timestamp < oldest.timestamp) {
                oldest = { id: stored.id, timestamp: stored.timestamp };
            }
        }

        return oldest?.id || null;
    }
}
