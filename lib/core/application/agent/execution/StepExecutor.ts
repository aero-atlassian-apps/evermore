/**
 * Step Executor - Encapsulates the execution logic for a single planned step.
 * 
 * Responsibilities:
 * - Execute the tool specified in the step
 * - Handle tool errors gracefully
 * - Track token usage and costs
 * - Return a structured result
 * 
 * @module StepExecutor
 */

import {
    PlannedStep,
    StepExecutor as IStepExecutor,
    ExecutionContext,
    StepResult
} from '../primitives/AgentPrimitives';
import { LLMPort } from '../../ports/LLMPort';
import { Tool } from '../types';

export class StepExecutor implements IStepExecutor {
    constructor(
        private llm: LLMPort,
        private tools: Tool[]
    ) { }

    async execute(step: PlannedStep, context: ExecutionContext): Promise<StepResult> {
        const startTime = Date.now();

        // 1. Identify Tool
        const toolName = step.tool || step.action; // Fallback to action if tool not explicit
        const tool = this.tools.find(t => t.metadata.id === toolName || t.metadata.name === toolName);

        // 2. Execution Logic
        let output: unknown;
        let success = false;
        let errorMsg: string | undefined;

        try {
            if (tool) {
                // Bridge to ToolExecutionContext
                const toolContext = {
                    userId: context.agentContext.userId || 'system',
                    sessionId: context.agentContext.sessionId || 'unknown',
                    agentId: 'step-executor',
                    requestId: `exec-${Date.now()}`,
                    permissions: new Map(), // Default empty, can be enhanced
                    dryRun: false
                };

                // Execute Tool
                const toolResult = await tool.execute(step.input, toolContext);

                if (toolResult.success) {
                    output = toolResult.data;
                    success = true;
                } else {
                    success = false;
                    errorMsg = toolResult.error?.message || 'Tool execution failed';
                    output = null;
                }
            } else if (step.action === 'Final Answer') {
                // Special case for Final Answer execution (just pass through)
                output = step.input;
                success = true;
            } else {
                // Tool Not Found
                errorMsg = `Tool '${toolName}' not found. Available tools: ${this.tools.map(t => t.metadata.name).join(', ')}`;
                success = false;
            }
        } catch (error: any) {
            errorMsg = `Tool execution failed: ${error.message}`;
            success = false;
        }

        // 3. Validation Layer
        // Skip validation for Final Answer, as it's typically just a text blob or simple object
        if (success && step.action !== 'Final Answer') {
            const validation = this.validateResult(output, step.expectedOutputType);
            if (!validation.valid) {
                success = false;
                errorMsg = `Tool output validation failed: ${validation.error}`;
                // Keep output for debugging but mark as failed
            }
        }

        // 3. Retry Logic (Simple inline check, main retry loop typically in Orchestrator)
        // If we wanted to do internal retries here, we could. 
        // For now, we return failure and let Orchestrator decide.

        const durationMs = Date.now() - startTime;

        return {
            stepId: step.id,
            success,
            output: output,
            error: errorMsg,
            // Simple heuristic estimation (4 chars ~= 1 token)
            // Ideally, LLM/Tool response should provide this.
            tokensUsed: Math.ceil(((JSON.stringify(step.input).length) + (JSON.stringify(output || '').length)) / 4),
            costCents: 0, // Placeholder - requires pricing model injection
            durationMs: durationMs,
            trace: {
                toolName,
                input: step.input,
                error: errorMsg
            }
        };
    }


    /**
     * Validates that the tool output matches expectations.
     * Enforces structured data policy.
     */
    private validateResult(output: unknown, expectedType: string): { valid: boolean; error?: string } {
        if (output === undefined || output === null) {
            return { valid: false, error: 'Output is null or undefined' };
        }

        // 1. Structural Check: Must be Object or Array (unless expected primitive)
        // We prefer structured data as per best practices
        const isStructured = typeof output === 'object';
        if (!isStructured && expectedType !== 'string' && expectedType !== 'number' && expectedType !== 'boolean') {
            return { valid: false, error: `Output must be structured (Object/Array), got ${typeof output}` };
        }

        // 2. Type Check (Basic)
        if (expectedType === 'array' && !Array.isArray(output)) {
            return { valid: false, error: `Expected Array, got ${typeof output}` };
        }
        if (expectedType === 'string' && typeof output !== 'string') {
            return { valid: false, error: `Expected string, got ${typeof output}` };
        }

        return { valid: true };
    }
}
