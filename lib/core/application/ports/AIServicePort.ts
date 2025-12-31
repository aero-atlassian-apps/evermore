export interface AIServicePort {
  generateQuestion(
    userUtterance: string,
    history: any[],
    memories: any[],
    imageContext?: string
  ): Promise<{ text: string; strategy: string }>;

  generateChapterAnalysis(transcript: string): Promise<any>;

  generateChapterNarrative(
    transcript: string,
    analysis: any
  ): Promise<{ content: string; wordCount: number }>;

  startVoiceConversation(userId: string, sessionId: string, userName: string, memories: any[], imageContext?: string): Promise<{
    agentId: string;
    conversationId: string;
    wsUrl?: string;
  }>;

  analyzeImage(imageBase64: string, mimeType: string): Promise<{
    description: string;
    detectedEntities: string[];
    conversationalTrigger?: string; // New field for Proustian Trigger
  }>;

  generateSpeech(text: string, style?: string): Promise<Buffer>;
}
