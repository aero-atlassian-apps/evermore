/**
 * Observation Reflector - Validates progress against the goal.
 * 
 * Analyzes the "Observation" from the ReAct loop to see if we have fulfilled the user's request.
 * 
 * @module ObservationReflector
 */

import {
    ReflectionValidator,
    ReflectionResult,
    ProcessedObservation
} from '../primitives/AgentPrimitives';
import { LLMPort } from '../../ports/LLMPort';

export class ObservationReflector implements ReflectionValidator {
    constructor(private llm: LLMPort) { }

    async validate(observations: ProcessedObservation[], goal: string): Promise<ReflectionResult> {
        // If no observations, we can't be done (unless it was a trivial greeting, handled upstream)
        if (observations.length === 0) {
            return {
                goalAchieved: false,
                confidence: 0,
                summary: "No actions taken yet.",
                keyFacts: [],
                outstandingQuestions: ["Everything"],
                qualityScore: 0,
                readyForUser: false
            };
        }

        const prompt = `
You are the "Reflector". Your job is to objectively judge if the agent has achieved the user's goal.

GOAL: "${goal}"

OBSERVATIONS OBTAINED:
${observations.map((o, i) => `${i + 1}. [${o.type}] ${o.insight} (${JSON.stringify(o.rawData).substring(0, 100)}...)`).join('\n')}

TASK:
1. Have we satisfied the goal?
2. Is the information sufficient and high quality?
3. HALLUCINATION CHECK: Verify that every fact is supported by an OBSERVATION.
4. Should we stop or keep going?

OUTPUT JSON:
{
  "goalAchieved": boolean,
  "confidence": 0.0 to 1.0,
  "summary": "What we know so far",
  "keyFacts": ["Fact 1 [Step 1]", "Fact 2 [Step 3]"], // CITATIONS REQUIRED
  "outstandingQuestions": ["what is missing?"],
  "qualityScore": 0.0 to 1.0, // Set to 0 if hallucination detected
  "readyForUser": boolean,
  "improvementSuggestions": ["suggestion"]
}
`;

        try {
            const result = await this.llm.generateJson<ReflectionResult>(prompt);
            return result;
        } catch (error) {
            console.error("Reflection failed", error);
            // Fail safe: assume not done if reflection fails
            return {
                goalAchieved: false,
                confidence: 0,
                summary: "Error during reflection",
                keyFacts: [],
                outstandingQuestions: ["Reflection failed"],
                qualityScore: 0,
                readyForUser: false
            };
        }
    }
}
