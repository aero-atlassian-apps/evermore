import { Message } from '@/lib/core/domain/value-objects/Message';

export interface ConversationState {
  isActive: boolean;
  sessionId?: string;
  messages: Message[];
  duration: number;
  isAgentSpeaking: boolean;
}
