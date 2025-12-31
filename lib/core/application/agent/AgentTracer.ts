import { AgentStep } from './types';

export class AgentTracer {
  private steps: AgentStep[] = [];
  private startTime: number;

  constructor(private sessionId: string) {
    this.startTime = Date.now();
  }

  logStep(step: AgentStep) {
    this.steps.push(step);
    // In production, this would go to a structured logger (Datadog, Cloud Logging)
    console.log(`[AgentTracer] Step:`, JSON.stringify(step));
  }

  getTrace() {
    return {
      sessionId: this.sessionId,
      durationMs: Date.now() - this.startTime,
      steps: this.steps,
    };
  }
}
