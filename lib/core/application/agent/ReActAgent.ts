import { LLMPort } from '../ports/LLMPort';
import { AgentStep, AgentRunResult, Tool, AgentContext, AgentPlan } from './types';
import { AgentTracer } from './AgentTracer';
import { AgentPlanner } from './AgentPlanner';

export class ReActAgent {
  private maxSteps = 5;
  private planner: AgentPlanner;

  constructor(
    private llm: LLMPort,
    private tools: Tool[],
    private systemPrompt: string
  ) {
    this.planner = new AgentPlanner(llm);
  }

  async run(
    goal: string,
    context: AgentContext,
    tracer?: AgentTracer
  ): Promise<AgentRunResult> {

    // 0. PLAN (AoT)
    let plan: AgentPlan | undefined;
    if (goal.length > 50) { // Simple heuristic: Plan for complex queries
      plan = await this.planner.createPlan(goal, context);
      if (tracer) tracer.logStep({ thought: "Created Plan", action: "Plan", actionInput: plan, observation: "Plan Created" });
    }

    const steps: AgentStep[] = [];
    let currentStepCount = 0;

    const toolDescriptions = this.tools
      .map((t) => `${t.metadata.name}: ${t.metadata.description} (Schema: ${JSON.stringify(t.inputSchema)})`)
      .join('\n');

    const history = `
GOAL: ${goal}
${plan ? `PLAN: ${JSON.stringify(plan.steps)}` : ''}
CONTEXT SUMMARY:
- User: ${context.userId}
- Recent Memories: ${JSON.stringify(context.memories.map(m => m.text).slice(0, 3))}
`;

    while (currentStepCount < this.maxSteps) {
      currentStepCount++;

      // 1. THINK
      const prompt = `
${this.systemPrompt}

TOOLS AVAILABLE:
${toolDescriptions}

HISTORY:
${history}

PAST STEPS:
${JSON.stringify(steps)}

INSTRUCTIONS:
- Reason about the next step.
- Choose a tool if you need more information or to perform an action.
- If you have enough information, output the "Final Answer".
- Strict JSON output.

OUTPUT FORMAT:
{
  "thought": "Reasoning...",
  "action": "ToolName" OR "Final Answer",
  "actionInput": { ...args... } OR "Response Text"
}
`;

      let stepResult: any;
      try {
        stepResult = await this.llm.generateJson<{
          thought: string;
          action: string;
          actionInput: any;
        }>(prompt);
      } catch (e) {
        console.error("ReAct Agent failed to reason", e);
        return {
          finalAnswer: "I'm sorry, I'm having trouble processing that right now.",
          steps,
          success: false
        };
      }

      // 2. ACT
      const step: AgentStep = {
        thought: stepResult.thought,
        action: stepResult.action,
        actionInput: stepResult.actionInput,
      };

      if (tracer) tracer.logStep(step);

      if (step.action === 'Final Answer') {
        steps.push(step);
        const finalAnswerText = typeof step.actionInput === 'string'
          ? step.actionInput
          : String(step.actionInput ?? '');
        return {
          finalAnswer: finalAnswerText,
          steps,
          success: true,
        };
      }

      // 3. OBSERVE
      const tool = this.tools.find((t) => t.metadata.id === step.action || t.metadata.name === step.action);
      if (tool) {
        try {
          const toolResult = await tool.execute(step.actionInput, {
            userId: context.userId || 'system',
            sessionId: context.sessionId || 'unknown',
            agentId: 'legacy-react',
            requestId: `legacy-${Date.now()}`,
            permissions: new Map(),
            dryRun: false
          });

          if (toolResult.success) {
            const observation = toolResult.data;
            step.observation = typeof observation === 'string' ? observation : JSON.stringify(observation);
          } else {
            step.observation = `Error: ${toolResult.error?.message}`;
          }
          steps.push(step);
        } catch (e: any) {
          step.observation = `Error: ${e.message}`;
          steps.push(step);
        }
      } else {
        step.observation = `Error: Tool ${step.action} not found.`;
        steps.push(step);
      }
    }

    return {
      finalAnswer: "I reached my reasoning limit before finding an answer.",
      steps,
      success: false,
    };
  }
}
