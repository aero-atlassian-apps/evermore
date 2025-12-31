import { ToolContract } from './tools/ToolContracts';

export interface AgentStep {
  thought: string;
  action: string;
  actionInput: any;
  observation?: string;
}

export interface AgentPlan {
  goal: string;
  steps: string[];
}

export type Tool = ToolContract<any, any>;

export interface AgentContext {
  userId: string;
  sessionId: string;
  memories: any[]; // RAG results
  recentHistory: any[]; // Chat history
}

export interface AgentRunResult {
  finalAnswer: string;
  steps: AgentStep[];
  success: boolean;
}
