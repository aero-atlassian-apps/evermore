import { AIServicePort } from '../../../core/application/ports/AIServicePort';

export class MockAIService implements AIServicePort {
  async generateQuestion(
    userUtterance: string,
    history: any[],
    memories: any[],
    imageContext?: string
  ): Promise<{ text: string; strategy: string }> {
    return {
      text: "That's fascinating. Tell me more about that moment.",
      strategy: "deepening_questions",
    };
  }

  async generateChapterAnalysis(transcript: string): Promise<any> {
    return {
      themes: ["Memory", "Childhood", "Technology"],
      sentiment: "positive",
      key_entities: ["Evermore", "AI"],
    };
  }

  async generateChapterNarrative(
    transcript: string,
    analysis: any
  ): Promise<{ content: string; wordCount: number }> {
    const content = "This is a mocked chapter narrative generated for local development. It captures the essence of the conversation in a beautifully written format.";
    return {
      content,
      wordCount: content.split(' ').length,
    };
  }

  async startVoiceConversation(userId: string, sessionId: string, userName: string, memories: any[], imageContext?: string): Promise<{
    agentId: string;
    conversationId: string;
    wsUrl?: string;
  }> {
    return {
      agentId: "mock-agent-id",
      conversationId: "mock-conversation-id",
      wsUrl: "ws://localhost:3000/api/mock-voice",
    };
  }

  async analyzeImage(imageBase64: string, mimeType: string): Promise<{
    description: string;
    detectedEntities: string[];
    conversationalTrigger?: string;
  }> {
    return {
      description: "A mocked analysis of the uploaded image.",
      detectedEntities: ["person", "smile"],
      conversationalTrigger: "I see you are smiling in this photo. What were you thinking about?",
    };
  }

  async generateSpeech(text: string, style?: string): Promise<Buffer> {
    // Return a valid empty buffer or a small silence MP3 equivalent if needed.
    // For now, an empty buffer is likely sufficient for integration tests that don't play audio,
    // but the frontend might expect a valid blob.
    return Buffer.from("mock-audio-data");
  }
}
