/**
 * Mock LLM Port for Testing.
 * 
 * Allows queuing responses for specific prompts or general JSON/Text returns.
 */

import { LLMPort } from '../../../core/application/ports/LLMPort';

export class MockLLM implements LLMPort {
    private jsonQueue: any[] = [];
    private textQueue: string[] = [];

    constructor() { }

    queueJson(response: any) {
        this.jsonQueue.push(response);
    }

    queueText(response: string) {
        this.textQueue.push(response);
    }

    async generateText(prompt: string): Promise<string> {
        console.log(`[MockLLM] generateText called`);
        if (this.textQueue.length > 0) {
            return this.textQueue.shift()!;
        }
        return "Mock Text Response";
    }

    async generateJson<T>(prompt: string): Promise<T> {
        console.log(`[MockLLM] generateJson called`);
        if (this.jsonQueue.length > 0) {
            return this.jsonQueue.shift() as T;
        }
        // Return a safe default based on expected types if possible, otherwise throw or return empty
        console.warn("MockLLM: JSON queue empty, returning empty object");
        return {} as T;
    }

    async analyzeImage(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
        return "Mock Image Analysis";
    }
}
