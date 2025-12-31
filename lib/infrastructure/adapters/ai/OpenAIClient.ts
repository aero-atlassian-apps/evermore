
import OpenAI from 'openai';

export class OpenAIClient {
  private client: OpenAI | null = null;
  private isMock: boolean = false;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      console.warn('OPENAI_API_KEY not found, using mock OpenAI client');
      this.isMock = true;
    }
  }

  async complete(params: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: any;
  }): Promise<any> {
    if (this.isMock) {
      console.log('Mock OpenAI complete called with:', params.messages);

      // Basic mock response logic based on input
      const lastMessage = params.messages[params.messages.length - 1].content.toLowerCase();
      const content = "That's very interesting. Tell me more.";

      if (lastMessage.includes('analyze') && lastMessage.includes('json')) {
         // Mocking analysis response
         return {
            choices: [{
                message: {
                    content: JSON.stringify({
                        title: "A Life Remembered",
                        entities: [],
                        tone: "nostalgic",
                        period: "childhood"
                    })
                }
            }]
         };
      }

      if (lastMessage.includes('extract people')) {
          // Mocking metadata extraction
          return {
              choices: [{
                  message: {
                      content: JSON.stringify({
                          people: [],
                          places: [],
                          temporal_markers: []
                      })
                  }
              }]
          };
      }

      // Conversation mock
      return {
        choices: [
          {
            message: {
              content: content,
            },
          },
        ],
      };
    }

    return await this.client!.chat.completions.create({
      model: 'gpt-4o',
      messages: params.messages as any,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? 500,
      response_format: params.response_format,
    });
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (this.isMock) {
      // Return a random 1536-dimensional vector
      return Array.from({ length: 1536 }, () => Math.random());
    }

    const response = await this.client!.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.isMock) {
      return texts.map(() => Array.from({ length: 1536 }, () => Math.random()));
    }

    const response = await this.client!.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    return response.data.map((d) => d.embedding);
  }
}
