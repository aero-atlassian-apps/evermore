/**
 * Port for generating vector embeddings from text.
 */
export interface EmbeddingPort {
    /**
     * Generate an embedding vector for a single piece of text.
     */
    generateEmbedding(text: string): Promise<number[]>;

    /**
     * Generate embeddings for a batch of text strings.
     */
    generateEmbeddings(texts: string[]): Promise<number[][]>;

    /**
     * Get the dimensions of the embedding vector.
     */
    getDimensions(): number;
}
