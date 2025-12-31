/**
 * Port for interacting with vector databases.
 */
export interface VectorStorePort {
  /**
   * Store a vector with metadata.
   */
  upsert(id: string, vector: number[], metadata: Record<string, any>): Promise<void>;

  /**
   * Query for similar vectors.
   */
  query(vector: number[], topK: number, filter?: Record<string, any>): Promise<VectorMatch[]>;

  /**
   * Delete a vector by ID.
   */
  delete(id: string): Promise<void>;

  /**
   * Clear all vectors for a specific user.
   */
  clear(userId: string): Promise<void>;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata: Record<string, any>;
}
