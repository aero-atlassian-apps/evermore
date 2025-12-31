import { VoiceAgentPort } from '../../../core/application/ports/VoiceAgentPort';
import { randomUUID } from 'crypto';

/**
 * A manual/REST-based voice agent adapter.
 * Used when a real-time WebSocket agent (like ElevenLabs Conversational AI) is not available
 * or when using fallback providers like Hugging Face.
 *
 * It returns a configuration that instructs the frontend to manage the conversation loop
 * via standard REST API calls (STT -> LLM -> TTS).
 */
export class ManualVoiceAgentAdapter implements VoiceAgentPort {
  async startConversation(
    userId: string,
    sessionId: string,
    userName: string,
    context: {
        goal: string;
        memories: any[];
        imageContext?: string;
    }
  ): Promise<{ agentId: string; conversationId: string; wsUrl?: string }> {
    // Return a config indicating "manual" mode.
    // The frontend should interpret 'wsUrl: undefined' or specific agentId as a signal
    // to use the transactional API endpoints.
    return {
        agentId: 'manual-agent',
        conversationId: sessionId, // In manual mode, session ID tracks the conversation
        wsUrl: undefined
    };
  }
}
