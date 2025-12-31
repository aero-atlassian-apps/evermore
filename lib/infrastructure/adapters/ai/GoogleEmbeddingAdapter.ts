import { EmbeddingPort } from '../../../core/application/ports/EmbeddingPort';
import { GoogleAuth } from 'google-auth-library';

/**
 * Adapter for Google Vertex AI Embeddings.
 */
export class GoogleEmbeddingAdapter implements EmbeddingPort {
    private endpoint: string;
    private auth: GoogleAuth;
    private projectId: string;
    private location: string;
    private modelId: string = 'text-embedding-004';
    private dimensions: number = 768; // Default for text-embedding-004
    private cache: Map<string, number[]> = new Map();
    private readonly MAX_CACHE_SIZE = 500;

    constructor(projectId: string, location: string = 'us-central1') {
        this.projectId = projectId;
        this.location = location;
        this.endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${this.modelId}:predict`;
        this.auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
        });
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (this.cache.has(text)) {
            return this.cache.get(text)!;
        }
        const results = await this.generateEmbeddings([text]);
        return results[0];
    }

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];

        const results: number[][] = new Array(texts.length);
        const toFetch: { text: string; index: number }[] = [];

        // Check cache
        texts.forEach((text, i) => {
            if (this.cache.has(text)) {
                results[i] = this.cache.get(text)!;
            } else {
                toFetch.push({ text, index: i });
            }
        });

        if (toFetch.length === 0) return results;

        try {
            const client = await this.auth.getClient();
            const instances = toFetch.map(item => ({ content: item.text }));

            const response = await client.request({
                url: this.endpoint,
                method: 'POST',
                data: {
                    instances,
                },
            });

            const data = response.data as any;
            const embeddings = data.predictions.map((p: any) => p.embeddings.values);

            // Update cache and final results
            embeddings.forEach((emb: number[], i: number) => {
                const originalIndex = toFetch[i].index;
                const text = toFetch[i].text;

                results[originalIndex] = emb;

                // Simple eviction
                if (this.cache.size >= this.MAX_CACHE_SIZE) {
                    const firstKey = this.cache.keys().next().value;
                    if (firstKey !== undefined) this.cache.delete(firstKey);
                }
                this.cache.set(text, emb);
            });

            return results;
        } catch (error) {
            console.error('[GoogleEmbeddingAdapter] Failed to generate embeddings:', error);
            throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    getDimensions(): number {
        return this.dimensions;
    }
}
