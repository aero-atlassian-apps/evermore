/**
 * Answer Synthesizer - Generates the final user-facing response.
 * 
 * Takes the raw facts/reflections and drafts a polite, empathetic or informative response.
 * 
 * @module AnswerSynthesizer
 */

import {
    AnswerSynthesizer as IAnswerSynthesizer,
    ReflectionResult,
    SynthesisConfig
} from '../primitives/AgentPrimitives';
import { LLMPort } from '../../ports/LLMPort';
import { AgentContext } from '../types';
import { RecognizedIntent } from '../primitives/AgentPrimitives';
import { logger } from '../../Logger';

export class AnswerSynthesizer implements IAnswerSynthesizer {
    constructor(private llm: LLMPort) { }

    async synthesize(
        reflections: ReflectionResult,
        context: AgentContext,
        config: SynthesisConfig = {
            audience: 'senior',
            tone: 'empathetic',
            includeCitations: false
        }
    ): Promise<string> {
        const prompt = `
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

        try {
            const response = await this.llm.generateText(prompt);
            return response;
        } catch (error) {
            logger.error('[AnswerSynthesizer] Synthesis failed', { error });
            return "I have gathered the information, but I'm having trouble putting it into words right now. Here is what I found: " + reflections.summary;
        }
    }

    async synthesizeSimpleReply(
        goal: string,
        intent: RecognizedIntent,
        context: AgentContext
    ): Promise<string> {
        const prompt = `
You are Evermore, a friendly and empathetic AI biographer.
The user just said: "${goal}"
Detected Intent: ${intent.primaryIntent}

INSTRUCTIONS:
- Provide a brief, warm, and natural response.
- If it's a greeting, return a warm welcome.
- If it's an end-of-session, say a kind goodbye.
- Keep it very short (1-2 sentences).

OUTPUT TEXT ONLY.
`;
        try {
            return await this.llm.generateText(prompt);
        } catch (error) {
            logger.error('[AnswerSynthesizer] Simple synthesis failed', { error });
            return "I'm here and listening. How can I help you with your story today?";
        }
    }
}
