/**
 * HuggingFace LLM Adapter - FREE LLM inference.
 * 
 * Uses HuggingFace Inference API with free models:
 * - Mistral-7B-Instruct (good balance of speed/quality)
 * - Llama-3-8B-Instruct (excellent quality)
 * - Phi-3-mini (fast, good for simple tasks)
 * 
 * Free tier: Unlimited with rate limiting
 * 
 * Configuration:
 * - HUGGINGFACE_API_KEY: Required API key
 * - LLM_RETRY_MAX_ATTEMPTS: Max retry attempts (default: 3)
 * 
 * @module HuggingFaceLLMAdapter
 */

import { LLMPort } from '../../../core/application/ports/LLMPort';

interface HFResponse {
    generated_text?: string;
    [key: number]: { generated_text: string };
}

export class HuggingFaceLLMAdapter implements LLMPort {
    private apiKey: string;
    private baseUrl = 'https://router.huggingface.co/hf-inference/models';
    private defaultModel = 'mistralai/Mistral-7B-Instruct-v0.2';
    private maxRetries: number;

    constructor() {
        this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
        this.maxRetries = parseInt(process.env.LLM_RETRY_MAX_ATTEMPTS || '3', 10);

        if (!this.apiKey) {
            throw new Error('HuggingFaceLLMAdapter: HUGGINGFACE_API_KEY is required');
        }
    }

    private async callHuggingFace(prompt: string, model?: string): Promise<string> {
        const modelId = model || this.defaultModel;
        const url = `${this.baseUrl}/${modelId}`;
        const formattedPrompt = this.formatPrompt(prompt, modelId);

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: formattedPrompt,
                        parameters: {
                            max_new_tokens: 2048,
                            temperature: 0.7,
                            return_full_text: false,
                            do_sample: true,
                        },
                        options: {
                            wait_for_model: true,
                        }
                    }),
                });

                if (response.status === 503) {
                    // Model is loading - retry with backoff
                    if (attempt < this.maxRetries) {
                        const delayMs = 5000 * attempt; // 5s, 10s, 15s
                        console.log(`[HuggingFaceLLMAdapter] Model loading (attempt ${attempt}/${this.maxRetries}). Retrying in ${delayMs / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                        continue;
                    }
                    throw new Error('HuggingFace API: Model unavailable after retries');
                }

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
                }

                const data: HFResponse | HFResponse[] = await response.json();

                if (Array.isArray(data)) {
                    return data[0]?.generated_text || '';
                }
                return data.generated_text || '';
            } catch (e: any) {
                lastError = e;
                if (attempt === this.maxRetries) {
                    throw e;
                }
            }
        }

        throw lastError;
    }

    private formatPrompt(prompt: string, model: string): string {
        if (model.includes('Mistral')) {
            return `<s>[INST] ${prompt} [/INST]`;
        }
        if (model.includes('Llama') || model.includes('llama')) {
            return `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`;
        }
        return prompt;
    }

    async generateText(
        prompt: string,
        options?: { model?: string; maxTokens?: number; temperature?: number }
    ): Promise<string> {
        return this.callHuggingFace(prompt, options?.model);
    }

    async generateJson<T>(
        prompt: string,
        _schema?: any,
        options?: { model?: string; maxTokens?: number; temperature?: number }
    ): Promise<T> {
        const jsonPrompt = `${prompt}

IMPORTANT: Respond with ONLY valid JSON. No explanations, no markdown. Just the JSON object.`;

        const text = await this.callHuggingFace(jsonPrompt, options?.model);

        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as T;
            }
            return JSON.parse(text.trim()) as T;
        } catch (e) {
            console.error('[HuggingFaceLLMAdapter] Failed to parse JSON:', text.substring(0, 200));
            throw new Error('Failed to parse JSON from LLM response');
        }
    }

    async analyzeImage(
        _imageBase64: string,
        _mimeType: string,
        _prompt: string,
        _options?: { model?: string }
    ): Promise<string> {
        // HuggingFace free tier doesn't support vision
        throw new Error('HuggingFaceLLMAdapter: Image analysis not supported. Use GoogleAIStudioAdapter for vision features.');
    }
}
