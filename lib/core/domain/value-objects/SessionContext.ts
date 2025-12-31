import { Message } from './Message';
import { Memory } from './Memory';

export interface SessionContext {
  userId: string;
  sessionId: string;
  history: Message[];
  memories: Memory[];
}
