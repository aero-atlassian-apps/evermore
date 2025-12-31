import { LLMPort } from '../ports/LLMPort';
import { VoiceAgentPort } from '../ports/VoiceAgentPort';
import { Memory } from '../../domain/value-objects/Memory';

// Type definition for Memory if not available in domain/entities yet,
// strictly it should be imported from domain.
// Assuming we have a Memory entity or interface.
// If not, we will define a minimal interface here or assume it's passed as is.
// For now, using 'any' with a TODO or interface if I can verify it.
// Checking previous DirectorService, it used 'any[]'.
// I will define a local interface for now or use `any` if strict domain type is missing.

export interface SessionContext {
    userId: string;
    sessionId: string;
    userName: string;
    memories: Memory[];
    imageContext?: string;
    topicsAvoid: string[];
    topicsLove: string[];
}

interface DirectorAnalysis {
    contextSummary: string;
    safetyRisks: string[];
    potentialStrategies: string[];
    selectedStrategy: string;
    finalGoal: string;
}

export class SessionGoalArchitect {
    constructor(
        private llm: LLMPort,
        private voiceAgent: VoiceAgentPort
    ) { }

    async determineSessionGoal(context: SessionContext) {
        const { userId, sessionId, userName, memories, imageContext, topicsAvoid, topicsLove } = context;

        // 1. Chain of Thought Execution (The Director Agent)
        let goal = "Ask about their childhood.";

        try {
            // We use a structured output to enforce the Chain of Thought process
            const prompt = `
You are the Director of an AI biography session. Your job is to plan the session goal using a Chain of Thought process.

SUBJECT: ${userName}
CONTEXT:
- Recent Memories: ${JSON.stringify(memories.slice(0, 3))}
- Image Context (if any): ${imageContext || "None"}
- Topics to Avoid: ${topicsAvoid.join(', ') || "None"}
- Topics to Love: ${topicsLove.join(', ') || "None"}

TASK: Perform the following reasoning steps to define the best session goal:
1. **Analyze Context**: Briefly summarize what we know and what's meaningful.
2. **Safety Check**: Check against "Topics to Avoid". Identify any risks.
3. **Brainstorm Strategies**: Propose 3 distinct conversational angles.
4. **Select Strategy**: Choose the best one that maximizes engagement and avoids risks.
5. **Final Goal**: Formulate a concise instruction (under 30 words) for the Interviewer AI.

OUTPUT FORMAT (JSON):
{
  "contextSummary": "...",
  "safetyRisks": ["..."],
  "potentialStrategies": ["...", "...", "..."],
  "selectedStrategy": "...",
  "finalGoal": "..."
}
`;
            const analysis = await this.llm.generateJson<DirectorAnalysis>(prompt);

            console.log(`[SessionGoalArchitect] Chain of Thought Result for ${userName}:`, JSON.stringify(analysis, null, 2));

            if (analysis.finalGoal) {
                goal = analysis.finalGoal;
            }

        } catch (e) {
            console.error("SessionGoalArchitect Chain of Thought failed, falling back to basic prompt.", e);
            // Fallback logic if JSON parsing fails
            const fallbackPrompt = `
                You are the Director of a biography project. Subject: ${userName}.
                Memories: ${JSON.stringify(memories.slice(0, 5))}
                ${topicsAvoid.length > 0 ? `CRITICAL CONSTRAINT - AVOID TOPICS: ${topicsAvoid.join(', ')}` : ''}
                ${imageContext ? `TRIGGER: User uploaded a photo: ${imageContext}` : ''}

                Define the session goal.
                ${imageContext ? 'GOAL: Explore the story behind the photo.' : 'GOAL: Explore a specific memory in depth.'}
                Keep it under 30 words.
             `;
            try {
                goal = await this.llm.generateText(fallbackPrompt, { maxTokens: 50 });
            } catch (fallbackError) {
                console.error("SessionGoalArchitect fallback also failed.", fallbackError);
            }
        }

        // 2. Start Voice Agent with this Goal
        return this.voiceAgent.startConversation(userId, sessionId, userName, {
            goal: goal.trim(),
            memories,
            imageContext
        });
    }
}
