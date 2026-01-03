/**
 * Ollama Adapter - Local LLM using Ollama
 * 
 * Provides LLMPort-compatible interface for local Llama-3-8B-Instruct.
 * Zero cost, full privacy, runs on CPU.
 * 
 * @module OllamaAdapter
 */

import { logger } from '@/lib/core/application/Logger';
import type { LLMPort } from '@/lib/core/application/ports/LLMPort';

// ============================================================================
// Types
// ============================================================================

interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OllamaRequest {
    model: string;
    messages: OllamaMessage[];
    stream?: boolean;
    format?: 'json';
    options?: {
        temperature?: number;
        top_p?: number;
        num_predict?: number;
    };
}

interface OllamaResponse {
    model: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
    total_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
}

// ============================================================================
// Ollama Adapter
// ============================================================================

export class OllamaAdapter implements LLMPort {
    private baseUrl: string;
    private defaultModel: string;

    constructor(
        baseUrl: string = process.env.OLLAMA_URL || 'http://localhost:11434',
        model: string = 'llama3:8b-instruct-q4_0'
    ) {
        this.baseUrl = baseUrl;
        this.defaultModel = model;
    }

    /**
     * Generate text using local Ollama.
     */
    async generateText(
        prompt: string,
        options?: { model?: string; maxTokens?: number; temperature?: number }
    ): Promise<string> {
        const model = options?.model || this.defaultModel;

        logger.debug('[OllamaAdapter] Generating text', {
            model,
            promptLength: prompt.length,
        });

        try {
            const ollamaRequest: OllamaRequest = {
                model,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                options: {
                    temperature: options?.temperature ?? 0.7,
                    num_predict: options?.maxTokens ?? 2048,
                },
            };

            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ollamaRequest),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();

            logger.debug('[OllamaAdapter] Text generated', {
                model,
                outputLength: data.message.content.length,
                durationMs: data.total_duration ? data.total_duration / 1e6 : 0,
            });

            return data.message.content;
        } catch (error) {
            logger.error('[OllamaAdapter] Generation failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Generate JSON using local Ollama.
     */
    async generateJson<T>(
        prompt: string,
        _schema?: unknown,
        options?: { model?: string; maxTokens?: number; temperature?: number }
    ): Promise<T> {
        const model = options?.model || this.defaultModel;

        logger.debug('[OllamaAdapter] Generating JSON', {
            model,
            promptLength: prompt.length,
        });

        try {
            const ollamaRequest: OllamaRequest = {
                model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that responds only with valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                stream: false,
                format: 'json',
                options: {
                    temperature: options?.temperature ?? 0.3,
                    num_predict: options?.maxTokens ?? 2048,
                },
            };

            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ollamaRequest),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();

            // Parse the JSON response
            const jsonContent = data.message.content;
            return JSON.parse(jsonContent) as T;
        } catch (error) {
            logger.error('[OllamaAdapter] JSON generation failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Analyze image using local Ollama (requires vision model).
     */
    async analyzeImage(
        imageBase64: string,
        mimeType: string,
        prompt: string,
        options?: { model?: string }
    ): Promise<string> {
        // Use a vision-capable model if available
        const model = options?.model || 'llava';

        logger.debug('[OllamaAdapter] Analyzing image', {
            model,
            imageSize: imageBase64.length,
        });

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    images: [imageBase64],
                    stream: false,
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama vision API error: ${response.status}`);
            }

            const data = await response.json();
            return data.response || '';
        } catch (error) {
            logger.error('[OllamaAdapter] Image analysis failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Check if Ollama is available.
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
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
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) return [];

            const data = await response.json();
            return data.models?.map((m: { name: string }) => m.name) || [];
        } catch {
            return [];
        }
    }
}

// ============================================================================
// Factory
// ============================================================================

let instance: OllamaAdapter | null = null;

export function getOllamaAdapter(): OllamaAdapter {
    if (!instance) {
        instance = new OllamaAdapter();
    }
    return instance;
}

export function isOllamaEnabled(): boolean {
    return process.env.LLM_PROVIDER === 'local' || process.env.LLM_PROVIDER === 'ollama';
}
