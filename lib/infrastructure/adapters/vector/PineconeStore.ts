import { VectorStorePort, VectorMatch } from '../../../core/application/ports/VectorStorePort';
import { Pinecone } from '@pinecone-database/pinecone';
import { EmbeddingPort } from '../../../core/application/ports/EmbeddingPort';

/**
 * PineconeStore - Production vector database adapter.
 * 
 * Configuration:
 * - PINECONE_API_KEY: Required API key
 * - Index name: recall-memories (must exist in Pinecone)
 * 
 * For local development without Pinecone, use InMemoryVectorStore via DI.
 * 
 * @module PineconeStore
 */
export class PineconeStore implements VectorStorePort {
    private pinecone: Pinecone;
    private indexName: string = 'recall-memories';

    constructor(private embeddingPort: EmbeddingPort) {
        const pineconeKey = process.env.PINECONE_API_KEY;

        if (!pineconeKey) {
            throw new Error('PineconeStore: PINECONE_API_KEY is required');
        }

        this.pinecone = new Pinecone({ apiKey: pineconeKey });
    }

    async upsert(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
        try {
            const index = this.pinecone.index(this.indexName);
            await index.upsert([{
                id,
                values: vector,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString()
                }
            }]);
        } catch (error) {
            console.error('[PineconeStore] Error upserting vector:', error);
            throw error;
        }
    }

    async query(vector: number[], topK: number, filter?: Record<string, any>): Promise<VectorMatch[]> {
        try {
            const index = this.pinecone.index(this.indexName);
            const queryResponse = await index.query({
                vector,
                topK,
                filter,
                includeMetadata: true
            });

            return queryResponse.matches.map(match => ({
                id: match.id,
                score: match.score || 0,
                metadata: (match.metadata as Record<string, any>) || {}
            }));
        } catch (error) {
            console.error('[PineconeStore] Error querying vector store:', error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const index = this.pinecone.index(this.indexName);
            await index.deleteOne(id);
        } catch (error) {
            console.error('[PineconeStore] Error deleting vector:', error);
            throw error;
        }
    }

    async clear(userId: string): Promise<void> {
        try {
            const index = this.pinecone.index(this.indexName);
            await index.deleteMany({ userId });
        } catch (error) {
            console.error('[PineconeStore] Error clearing user vectors:', error);
            throw error;
        }
    }
}
