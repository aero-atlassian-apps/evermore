/**
 * LocalAI Image Adapter - Local Image Generation
 * 
 * Uses LocalAI with SDXL-Turbo for local image generation.
 * OpenAI Images-compatible API, zero cost, full privacy.
 * 
 * Note: Image generation takes 30-60s on CPU (vs 5s in cloud).
 * 
 * @module LocalAIImageAdapter
 */

import { logger } from '@/lib/core/application/Logger';

// ============================================================================
// Types
// ============================================================================

export interface ImageGenerationOptions {
    size?: '256x256' | '512x512' | '1024x1024';
    n?: number;
    style?: 'vivid' | 'natural';
    quality?: 'standard' | 'hd';
}

export interface GeneratedImage {
    url?: string;
    b64_json?: string;
}

export interface ImageGenerationResult {
    images: GeneratedImage[];
    model: string;
    created: number;
}

// ============================================================================
// LocalAI Image Adapter
// ============================================================================

export class LocalAIImageAdapter {
    private baseUrl: string;
    private model: string;

    constructor(
        baseUrl: string = process.env.LOCALAI_URL || 'http://localhost:8080',
        model: string = 'stablediffusion-turbo'
    ) {
        this.baseUrl = baseUrl;
        this.model = model;
    }

    /**
     * Generate an image from a text prompt.
     */
    async generate(
        prompt: string,
        options: ImageGenerationOptions = {}
    ): Promise<ImageGenerationResult> {
        logger.info('[LocalAIImageAdapter] Generating image (this may take 30-60s on CPU)', {
            promptLength: prompt.length,
            size: options.size || '512x512',
        });

        const startTime = Date.now();

        try {
            const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: this.model,
                    size: options.size || '512x512',
                    n: options.n || 1,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`LocalAI image generation failed: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const durationMs = Date.now() - startTime;

            logger.info('[LocalAIImageAdapter] Image generated', {
                durationMs,
                imagesCount: data.data?.length || 0,
            });

            return {
                images: data.data || [],
                model: this.model,
                created: Math.floor(Date.now() / 1000),
            };
        } catch (error) {
            logger.error('[LocalAIImageAdapter] Image generation failed', {
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - startTime,
            });
            throw error;
        }
    }

    /**
     * Generate image and return as base64.
     */
    async generateBase64(
        prompt: string,
        options: ImageGenerationOptions = {}
    ): Promise<string> {
        const result = await this.generate(prompt, options);

        if (result.images.length === 0) {
            throw new Error('No images generated');
        }

        const image = result.images[0];

        if (image.b64_json) {
            return image.b64_json;
        }

        if (image.url) {
            // Fetch and convert to base64
            const response = await fetch(image.url);
            const buffer = await response.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
        }

        throw new Error('No image data in response');
    }

    /**
     * Check if LocalAI is available.
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get available models.
     */
    async getModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`);
            if (!response.ok) return [];

            const data = await response.json();
            return data.data?.map((m: { id: string }) => m.id) || [];
        } catch {
            return [];
        }
    }

    /**
     * Check if image model is loaded.
     */
    async isModelLoaded(): Promise<boolean> {
        const models = await this.getModels();
        return models.some(m => m.includes('stable') || m.includes('sdxl'));
    }
}

// ============================================================================
// Factory
// ============================================================================

let instance: LocalAIImageAdapter | null = null;

export function getLocalAIImageAdapter(): LocalAIImageAdapter {
    if (!instance) {
        instance = new LocalAIImageAdapter();
    }
    return instance;
}

export function isLocalImageEnabled(): boolean {
    return process.env.IMAGE_PROVIDER === 'local' || process.env.IMAGE_PROVIDER === 'localai';
}
