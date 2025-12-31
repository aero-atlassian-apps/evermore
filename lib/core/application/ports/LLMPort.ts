export interface LLMPort {
  generateText(prompt: string, options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<string>;
  generateJson<T>(prompt: string, schema?: any, options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<T>;
  analyzeImage(imageBase64: string, mimeType: string, prompt: string, options?: { model?: string }): Promise<string>;
}
