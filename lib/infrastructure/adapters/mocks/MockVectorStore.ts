import { VectorStorePort, VectorMatch } from '../../../core/application/ports/VectorStorePort';

export class MockVectorStore implements VectorStorePort {
  async upsert(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    console.log(`[MockVectorStore] Upserted vector ${id}`);
  }

  async query(vector: number[], topK: number, filter?: Record<string, any>): Promise<VectorMatch[]> {
    console.log(`[MockVectorStore] Querying vectors (topK=${topK})`);
    return [
      { id: 'mock-1', score: 0.95, metadata: { text: "Mock memory context 1", type: "generic" } },
      { id: 'mock-2', score: 0.85, metadata: { text: "Mock memory context 2", type: "generic" } },
    ];
  }

  async delete(id: string): Promise<void> {
    console.log(`[MockVectorStore] Deleted vector ${id}`);
  }

  async clear(userId: string): Promise<void> {
    console.log(`[MockVectorStore] Cleared vectors for user ${userId}`);
  }

  // Legacy methods for compatibility if needed (but interface doesn't require them anymore)
  async storeConversation(sessionId: string, transcript: string, userId: string): Promise<void> {
    console.log(`[MockVectorStore] Stored conversation for session ${sessionId}`);
  }

  async retrieveContext(userId: string, currentTopic?: string): Promise<any[]> {
    return [
      { text: "Mock memory context 1", metadata: { type: "generic" } },
      { text: "Mock memory context 2", metadata: { type: "generic" } },
    ];
  }
}
