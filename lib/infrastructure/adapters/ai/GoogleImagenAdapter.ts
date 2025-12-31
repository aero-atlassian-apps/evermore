/**
 * Google Imagen Adapter - Image Generation via Vertex AI
 * 
 * Uses Google's Imagen API for high-quality children's book illustrations.
 * Automatically includes safety filters and storybook-optimized prompts.
 */

import {
    ImageGenerationPort,
    ImageGenerationOptions,
    GeneratedImage
} from '../../../core/application/ports/ImageGenerationPort';

export class GoogleImagenAdapter implements ImageGenerationPort {
    private projectId: string;
    private location: string;
    private modelId: string;

    constructor(config?: { projectId?: string; location?: string }) {
        this.projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
        this.location = config?.location || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        // Start with Imagen 4 (50 RPM) -> Imagen 3 (1 RPM) -> Imagen 2 (Fallback)
        this.modelId = 'imagen-4.0-generate-001';

        if (!this.projectId) {
            console.warn('[GoogleImagenAdapter] No project ID configured, will use mock mode');
        }
    }

    async isAvailable(): Promise<boolean> {
        return !!this.projectId && !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64);
    }

    async generateImage(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage> {
        // Enhance prompt for children's book style
        const enhancedPrompt = this.enhancePromptForStorybook(prompt, options?.style);

        if (!(await this.isAvailable())) {
            console.log('[GoogleImagenAdapter] Using placeholder - no credentials');
            return this.generatePlaceholder(prompt);
        }

        try {
            // Dynamically import Google AI Platform client
            // This is an optional dependency - falls back to placeholder if not installed
            let PredictionServiceClient: any;
            let helpers: any;
            try {
                const aiplatform = await import('@google-cloud/aiplatform' as any);
                PredictionServiceClient = aiplatform.PredictionServiceClient;
                helpers = aiplatform.helpers;
            } catch (importError) {
                console.log('[GoogleImagenAdapter] @google-cloud/aiplatform not installed, using placeholder');
                return this.generatePlaceholder(prompt);
            }

            const clientOptions: any = {
                apiEndpoint: `${this.location}-aiplatform.googleapis.com`,
            };

            // Support Base64 credentials (for Vercel/serverless deployments)
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                try {
                    const credsJson = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf-8');
                    clientOptions.credentials = JSON.parse(credsJson);
                } catch (e) {
                    console.warn('[GoogleImagenAdapter] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_BASE64');
                }
            }

            const client = new PredictionServiceClient(clientOptions);

            // TIERED GENERATION STRATEGY
            // 1. Try Imagen 4 (50 RPM default) - Best for quota
            // 2. Try Imagen 3 (1 RPM default) - High quality fallback
            // 3. Try Imagen 2 (Legacy) - Last resort fallback
            const modelsToTry = [
                {
                    id: 'imagen-4.0-generate-001',
                    name: 'Imagen 4',
                    params: {
                        sampleCount: 1,
                        aspectRatio: '4:3'
                    }
                },
                {
                    id: 'imagen-3.0-generate-002',
                    name: 'Imagen 3',
                    params: {
                        sampleCount: 1,
                        aspectRatio: '4:3'
                    }
                },
                {
                    id: 'imagegeneration@005',
                    name: 'Imagen 2',
                    params: {
                        sampleCount: 1,
                        aspectRatio: '4:3'
                    }
                }
            ];

            let lastError;

            for (const model of modelsToTry) {
                try {
                    console.log(`[GoogleImagenAdapter] Attempting generation with ${model.name} (${model.id})...`);
                    const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model.id}`;

                    const instanceValue = helpers.toValue({ prompt: enhancedPrompt });
                    const parametersValue = helpers.toValue(model.params);

                    const [response] = await client.predict({
                        endpoint,
                        instances: [instanceValue],
                        parameters: parametersValue,
                    });

                    const predictions = response.predictions as any[];
                    if (!predictions || predictions.length === 0) {
                        throw new Error('No image generated');
                    }

                    // Handle potential protobuf wrapping in response
                    let imageBytes;
                    const firstPrediction = predictions[0];

                    if (firstPrediction && firstPrediction.bytesBase64Encoded) {
                        imageBytes = firstPrediction.bytesBase64Encoded;
                    } else if (firstPrediction.structValue && firstPrediction.structValue.fields && firstPrediction.structValue.fields.bytesBase64Encoded) {
                        // If wrapped in structValue (common in some client versions)
                        imageBytes = firstPrediction.structValue.fields.bytesBase64Encoded.stringValue;
                    }

                    if (!imageBytes) {
                        throw new Error('Image bytes not found in prediction response');
                    }

                    return {
                        base64: imageBytes,
                        mimeType: 'image/png',
                        prompt: enhancedPrompt,
                        metadata: {
                            model: model.id,
                            revisedPrompt: enhancedPrompt,
                        },
                    };

                } catch (err: any) {
                    console.warn(`[GoogleImagenAdapter] Failed with ${model.name}: ${err.message}`);
                    lastError = err;
                    // Continue to next model
                }
            }

            // If we get here, all models failed
            throw lastError || new Error('All image generation models failed');

        } catch (error: any) {
            console.error('[GoogleImagenAdapter] All generation attempts failed:', error.message);
            // Fallback to placeholder
            return this.generatePlaceholder(prompt);
        }
    }

    async generateStorybookImages(
        scenes: Array<{ pageNumber: number; imagePrompt: string }>,
        options?: ImageGenerationOptions
    ): Promise<Map<number, GeneratedImage>> {
        const results = new Map<number, GeneratedImage>();

        // Generate images sequentially to avoid rate limits
        for (const scene of scenes) {
            try {
                const image = await this.generateImage(scene.imagePrompt, options);
                results.set(scene.pageNumber, image);
            } catch (error) {
                console.error(`Failed to generate image for page ${scene.pageNumber}:`, error);
                results.set(scene.pageNumber, this.generatePlaceholder(scene.imagePrompt));
            }

            // Small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }

    private enhancePromptForStorybook(prompt: string, style?: string): string {
        const stylePrefix = style === 'watercolor'
            ? 'Warm watercolor children\'s book illustration.'
            : style === 'cartoon'
                ? 'Colorful cartoon children\'s book illustration.'
                : 'Warm, nostalgic children\'s book illustration in the style of classic picture books.';

        const suffix = 'Family-friendly, no text, no speech bubbles, soft lighting, warm colors.';

        return `${stylePrefix} ${prompt} ${suffix}`;
    }

    private generatePlaceholder(prompt: string): GeneratedImage {
        // Generate a simple placeholder SVG as base64
        const shortPrompt = prompt.substring(0, 50).replace(/[<>&"']/g, '');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#FFF5EB"/>
                    <stop offset="100%" style="stop-color:#FFE4D1"/>
                </linearGradient>
            </defs>
            <rect width="600" height="400" fill="url(#bg)"/>
            <rect x="20" y="20" width="560" height="360" fill="none" stroke="#E8C4A8" stroke-width="4" rx="20"/>
            <text x="300" y="180" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#8B6914">
                🎨 Illustration
            </text>
            <text x="300" y="220" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#A08060">
                ${shortPrompt}...
            </text>
            <text x="300" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="#C0A080">
                (Image will be generated when API is configured)
            </text>
        </svg>`;

        const base64 = Buffer.from(svg).toString('base64');

        return {
            base64,
            mimeType: 'image/svg+xml',
            prompt,
            metadata: {
                model: 'placeholder',
            },
        };
    }
}
