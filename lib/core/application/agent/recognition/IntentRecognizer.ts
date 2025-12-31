/**
 * Intent Recognizer - Classifies user input into structured intents.
 * 
 * Uses an LLM to understand what the user wants:
 * - Share a memory? -> Biographer Mode
 * - Remember something? -> Retrieval Mode
 * - Just chatting? -> Conversational Mode
 * 
 * @module IntentRecognizer
 */

import {
    IntentRecognizer as IIntentRecognizer,
    RecognizedIntent,
    IntentType
} from '../primitives/AgentPrimitives';
import { LLMPort } from '../../ports/LLMPort';
import { AgentContext } from '../types';

export class IntentRecognizer implements IIntentRecognizer {
    constructor(private llm: LLMPort) { }

    async recognize(input: string, context: AgentContext): Promise<RecognizedIntent> {
        const prompt = `
You are the "Cortex" of an advanced AI biographer.
Your job is to CLASSIFY the user's intent from their input.

USER INPUT: "${input}"

CONTEXT:
- User ID: ${context.userId}
- Recent history summary:
${this.formatHistory(context.recentHistory)}

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

        try {
            const result = await this.llm.generateJson<RecognizedIntent>(prompt);

            // Validate / Default if LLM hallucinates
            // @ts-ignore
            if (!Object.values(IntentType).includes(result.primaryIntent)) {
                return {
                    primaryIntent: IntentType.UNKNOWN,
                    confidence: 0,
                    entities: {},
                    requiresMemoryLookup: false,
                    requiresSafetyCheck: false,
                    reasoning: "Invalid intent type returned by LLM"
                };
            }

            return result;
        } catch (error) {
            console.error("Intent Recognition Failed", error);
            // Fallback
            return {
                primaryIntent: IntentType.UNKNOWN,
                confidence: 0,
                entities: {},
                requiresMemoryLookup: false,
                requiresSafetyCheck: false,
                reasoning: "LLM Generation Failed"
            };
        }
    }

    private formatHistory(history: any[]): string {
        if (!history || history.length === 0) return "No recent history";
        // Take last 3 messages for context budget discipline
        const recent = history.slice(-3);
        return recent.map(h => {
            if (typeof h === 'string') return h;
            // Assuming simplified message object structure if not string
            return `[${h.role || 'unknown'}]: ${h.content || JSON.stringify(h)}`;
        }).join('\n');
    }
}
