import { LLMPort } from '../../../core/application/ports/LLMPort';
import * as crypto from 'crypto';

interface GeminiResponse {
    candidates?: Array<{
        content: {
            parts: Array<{ text?: string }>;
        };
    }>;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
    };
}

/**
 * GoogleAIStudioAdapter - Pure Gemini API client.
 * 
 * This adapter is intentionally simple and stateless:
 * - Makes single API calls to Gemini
 * - Reports errors as-is (no retry logic)
 * - Logs usage metadata for observability
 * 
 * Retry logic, rate limiting, and queuing are handled by LLMGateway.
 * 
 * Configuration:
 * - GOOGLE_AI_API_KEY: Required API key
 * 
 * @module GoogleAIStudioAdapter
 */

const logger = {
    info: (msg: string, meta?: any) => console.log(`[GoogleAIStudioAdapter] ${msg}`, meta || ''),
    warn: (msg: string, meta?: any) => console.warn(`[GoogleAIStudioAdapter] ${msg}`, meta || ''),
    error: (msg: string, meta?: any) => console.error(`[GoogleAIStudioAdapter] ${msg}`, meta || ''),
};

export class GoogleAIStudioAdapter implements LLMPort {
    private apiKey: string;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    private model = 'gemini-2.0-flash-exp';

    constructor() {
        this.apiKey = process.env.GOOGLE_AI_API_KEY || '';

        if (!this.apiKey) {
            throw new Error('GoogleAIStudioAdapter: GOOGLE_AI_API_KEY is required');
        }

        logger.info('GoogleAIStudioAdapter initialized (pure client mode)');
    }

    async generateText(
        prompt: string,
        options?: { model?: string; maxTokens?: number; temperature?: number; jsonMode?: boolean }
    ): Promise<string> {
        const model = options?.model || this.model;

        const contents = [{
            role: 'user',
            parts: [{ text: prompt }]
        }];

        const generationConfig: any = {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 1024,
        };

        if (options?.jsonMode) {
            generationConfig.responseMimeType = "application/json";
        }

        return this.callGemini(model, { contents, generationConfig });
    }

    async generateJson<T>(
        prompt: string,
        schema?: any,
        options?: { model?: string; maxTokens?: number; temperature?: number }
    ): Promise<T> {
        const jsonPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON matching this schema: ${JSON.stringify(schema || {})}`;

        const optionsWithJson = { ...options, jsonMode: true };
        const responseText = await this.generateText(jsonPrompt, optionsWithJson);

        // Clean and parse JSON response
        let cleanText = responseText.replace(/```json\n?|\n?```/g, '').trim();
        cleanText = cleanText.replace(/^Here is the JSON.*$/im, '').trim();

        try {
            return JSON.parse(cleanText) as T;
        } catch (e) {
            // Try to extract JSON object from response
            const match = cleanText.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]) as T;
            }
            logger.error('Failed to parse JSON response', { text: cleanText.substring(0, 200) });
            throw new Error('Failed to parse JSON from LLM response');
        }
    }

    async analyzeImage(
        imageBase64: string,
        mimeType: string,
        prompt: string,
        options?: { model?: string }
    ): Promise<string> {
        const model = options?.model || this.model;

        const contents = [{
            role: 'user',
            parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } }
            ]
        }];

        return this.callGemini(model, { contents });
    }

    /**
     * Make a single API call to Gemini.
     * 
     * This method does NOT retry - that responsibility belongs to LLMGateway.
     * Errors are thrown as-is for the gateway to handle.
     */
    private async callGemini(model: string, payload: any): Promise<string> {
        const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
        const requestId = crypto.randomUUID();
        const startTime = Date.now();

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Report errors for gateway to handle
        if (response.status === 404) {
            throw new Error(`Model ${model} not found`);
        }

        if (response.status === 429) {
            // Include Retry-After header if present
            const retryAfter = response.headers.get('Retry-After');
            throw new Error(`RATE_LIMIT:${retryAfter || '60'}`);
        }

        if (response.status === 503) {
            throw new Error('SERVICE_OVERLOADED');
        }

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errText}`);
        }

        const data: GeminiResponse = await response.json();

        const inputTokens = data.usageMetadata?.promptTokenCount || 0;
        const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

        logger.info('LLM request completed', {
            requestId,
            model,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            durationMs: Date.now() - startTime
        });

        if (!data.candidates || data.candidates.length === 0) {
            return '';
        }

        return data.candidates[0].content.parts[0].text || '';
    }
}
