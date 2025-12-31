export interface VoiceAgentPort {
  /**
   * Starts a managed voice session (e.g. ElevenLabs Conversational AI).
   * Returns details needed by the frontend to connect (e.g. WebSocket URL, Agent ID).
   */
  startConversation(
    userId: string,
    sessionId: string,
    userName: string,
    context: {
        goal: string;
        memories: any[];
        imageContext?: string;
    }
  ): Promise<{ agentId: string; conversationId: string; wsUrl?: string }>;
}
