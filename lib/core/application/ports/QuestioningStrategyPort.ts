import { SessionContext } from '@/lib/core/domain/value-objects/SessionContext';

export interface QuestioningStrategy {
  buildPrompt(userUtterance: string, context: SessionContext): { system: string };
}
