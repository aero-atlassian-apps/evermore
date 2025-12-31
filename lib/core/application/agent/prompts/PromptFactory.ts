/**
 * Prompt Factory - Centralized prompt generation.
 * 
 * Generates specific prompts for each agent phase.
 * Ensures strict contracts and versioning for prompts.
 * 
 * @module PromptFactory
 */

import { IntentType, SynthesisConfig } from '../primitives/AgentPrimitives';
import { AgentContext } from '../types';

export class PromptFactory {

    static getIntentRecognitionPrompt(input: string, context: AgentContext): string {
        return `
You are the "Cortex" of an advanced AI biographer.
Your job is to CLASSIFY the user's intent from their input.

USER INPUT: "${input}"

CONTEXT:
- User ID: ${context.userId}
- Recent history summary: "(Last 2 messages)"

POSSIBLE INTENTS:
- SHARE_MEMORY: User is telling a story or facts about their life.
- RECALL_MEMORY: User is asking to remember something they said before.
- SHARE_EMOTION: User is expressing feelings (sadness, joy, etc.).
- ASK_QUESTION: User is asking a general knowledge question.
- CHANGE_TOPIC: User wants to talk about something else.
- GREETING: Hello, Hi, etc.
- END_SESSION: Goodbye, stop, etc.

OUTPUT JSON FORMAT:
{
  "primaryIntent": "IntentType",
  "confidence": 0.0 to 1.0,
  "entities": { "key": "value" },
  "requiresMemoryLookup": boolean,
  "requiresSafetyCheck": boolean,
  "reasoning": "Why you chose this intent"
}
`;
    }

    static getReflectionPrompt(goal: string, observations: any[]): string {
        return `
You are the "Reflector". Your job is to objectively judge if the agent has achieved the user's goal.

GOAL: "${goal}"

OBSERVATIONS OBTAINED:
${observations.map((o, i) => `${i + 1}. [${o.type}] ${o.insight} (${JSON.stringify(o.rawData).substring(0, 100)}...)`).join('\n')}

TASK:
1. Have we satisfied the goal?
2. Is the information sufficient and high quality?
3. Should we stop or keep going?

OUTPUT JSON:
{
  "goalAchieved": boolean,
  "confidence": 0.0 to 1.0,
  "summary": "What we know so far",
  "keyFacts": ["fact1", "fact2"],
  "outstandingQuestions": ["what is missing?"],
  "qualityScore": 0.0 to 1.0,
  "readyForUser": boolean,
  "improvementSuggestions": ["suggestion"]
}
`;
    }

    static getSynthesisPrompt(
        reflections: any,
        context: AgentContext,
        config: SynthesisConfig
    ): string {
        return `
You are Evermore, a friendly and empathetic AI biographer.
Your task is to synthesize a final answer for the user based on your research.

USER: ${context.userId}
TONE: ${config.tone}
AUDIENCE: ${config.audience}

INTERNAL REFLECTION:
- Goal Achieved: ${reflections.goalAchieved}
- Summary: ${reflections.summary}
- Key Facts: ${JSON.stringify(reflections.keyFacts)}
- Outstanding: ${JSON.stringify(reflections.outstandingQuestions)}

INSTRUCTIONS:
- Write a natural, conversational response.
- If the goal was NOT achieved, explain why gently.
- Incorporate the key facts naturally.
- Do NOT mention "Internal Reflection" or "Steps".
- Keep it under 200 words unless asked for a long story.

OUTPUT TEXT ONLY.
`;
    }
}
