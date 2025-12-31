import { AgentPlan, AgentContext } from './types';
import { LLMPort } from '../ports/LLMPort';

export class AgentPlanner {
  constructor(private llm: LLMPort) {}

  async createPlan(goal: string, context: AgentContext): Promise<AgentPlan> {
    const prompt = `
GOAL: ${goal}
CONTEXT:
- User: ${context.userId}
- Memories: ${JSON.stringify(context.memories.slice(0, 3))}

TASK: Create a high-level step-by-step plan to achieve this goal.
OUTPUT JSON: { "goal": "${goal}", "steps": ["Step 1", "Step 2", ...] }
`;

    try {
      const plan = await this.llm.generateJson<AgentPlan>(prompt);
      return plan;
    } catch (e) {
      console.error("AgentPlanner failed", e);
      return { goal, steps: ["Assess situation", "Take action"] };
    }
  }
}
