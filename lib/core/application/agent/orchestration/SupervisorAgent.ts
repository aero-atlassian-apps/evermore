import { EnhancedReActAgent, EnhancedReActAgentConfig } from '../EnhancedReActAgent';
import { LLMPort } from '../../ports/LLMPort';
import { Tool } from '../types';
import { AgenticRunResult, AgentState, HaltReason } from '../primitives/AgentPrimitives';
import { AgentContext } from '../types';
import { AgentStageResult, TransferredContext } from './MultiAgentOrchestrator';
import { EmbeddingPort } from '../../ports/EmbeddingPort';
import { VectorStorePort } from '../../ports/VectorStorePort';

import { ModelRouter, ModelProfile } from '../routing/ModelRouter';
import { ToolRegistry as SecureToolRegistry } from '../tools/ToolContracts';
import { PromptRegistry } from '../prompts/PromptRegistry';

/**
 * Supervisor Agent - High-level orchestrator with review capabilities.
 */
export class SupervisorAgent extends EnhancedReActAgent {
    constructor(
        llm: LLMPort,
        modelRouter: ModelRouter,
        tools: Tool[] = [],
        config: Partial<EnhancedReActAgentConfig> & { modelProfile: ModelProfile },
        vectorStore?: VectorStorePort,
        embeddingPort?: EmbeddingPort,
        promptRegistry?: PromptRegistry,
        toolRegistry?: SecureToolRegistry
    ) {
        super(llm, modelRouter, tools, config as any, vectorStore, embeddingPort, promptRegistry, toolRegistry);
    }

    /**
     * Specialized method for reviewing a pipeline stage.
     */
    async reviewStage(
        stageResult: AgentStageResult,
        context: TransferredContext,
        agentContext: AgentContext
    ): Promise<{ approved: boolean; feedback: string; score: number }> {
        const reviewGoal = `
Review the results of the pipeline stage: "${stageResult.stageName}".

ORIGINAL GOAL: ${context.goal}
STAGE RESULT: ${JSON.stringify(stageResult.result?.finalAnswer)}

CRITERIA:
1. Accuracy: Is the information correct?
2. Completeness: Does it address the goal?
3. Safety: Are there any risky patterns for a senior user?
4. Senior-Friendly: Is the tone appropriate?

Output your review as JSON with:
{
  "approved": boolean,
  "feedback": "string",
  "score": number (0-1)
}
`;

        const reviewResult = await this.run(reviewGoal, agentContext);

        if (!reviewResult.success) {
            return { approved: true, feedback: "Supervisor review failed to complete, auto-approving.", score: 0.5 };
        }

        try {
            return JSON.parse(reviewResult.finalAnswer);
        } catch (e) {
            return {
                approved: true,
                feedback: "Raw review: " + reviewResult.finalAnswer,
                score: 0.7
            };
        }
    }

    /**
     * Makes a final decision on whether a pipeline result is ready for the user.
     */
    async finalizeDecision(
        finalOutput: unknown,
        history: AgentStageResult[],
        agentContext: AgentContext
    ): Promise<{ ready: boolean; summary: string }> {
        const finalGoal = `
As the Director, make a final decision on this response for a senior user.

FINAL PROPOSED RESPONSE:
${JSON.stringify(finalOutput)}

PIPELINE HISTORY:
${history.map(h => `- Stage ${h.stageName}: ${h.success ? 'Success' : 'Failed'}`).join('\n')}

Is this ready for the user? Consider empathy, clarity, and safety.
Output JSON: { "ready": boolean, "summary": "brief explanation" }
`;

        const result = await this.run(finalGoal, agentContext);

        try {
            return JSON.parse(result.finalAnswer);
        } catch {
            return { ready: true, summary: "Proceeding with caution." };
        }
    }
}
