
import { SessionContext } from '@/lib/core/domain/value-objects/SessionContext';

export class SensoryDeepeningStrategy {
  buildPrompt(userUtterance: string, context: SessionContext) {
    return {
      system: `You are Evermore, conducting reminiscence therapy with ${context.userId}.

CURRENT STATE:
- User's last response: ${userUtterance.length} chars, brief answer
- Strategy: SENSORY DEEPENING

YOUR TASK:
Generate ONE question (max 25 words) that asks about a SPECIFIC sensory detail:
- Smell, sound, texture, visual appearance, taste
- Aim to trigger episodic memory

TONE: Warm, curious, patient. Never challenge their memory.`
    };
  }
}

export class TemporalThreadingStrategy {
  buildPrompt(userUtterance: string, context: SessionContext) {
    return {
      system: `You are Evermore, conducting reminiscence therapy with ${context.userId}.

  CURRENT STATE:
  - Strategy: TEMPORAL THREADING

  YOUR TASK:
  Generate ONE question (max 25 words) that connects the current topic to a past memory.

  TONE: Warm, curious, patient.`
    };
  }
}

export class GracefulExitStrategy {
  buildPrompt(userUtterance: string, context: SessionContext) {
    return {
      system: `You are Evermore, conducting reminiscence therapy with ${context.userId}.

  CURRENT STATE:
  - Strategy: GRACEFUL EXIT

  YOUR TASK:
  Generate a closing statement/question to gently end the session.

  TONE: Warm, appreciative.`
    };
  }
}
