/**
 * Tool Contract System - Type-safe tool definitions with validation.
 * 
 * Implements a robust tool contract system following DDD principles:
 * - Strongly typed tool inputs and outputs
 * - Runtime validation using schemas
 * - Tool capability discovery
 * - Permission boundaries
 * - Audit logging
 * 
 * @module ToolContracts
 */

import { z, ZodSchema, ZodError } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Tool capability categories.
 */
export enum ToolCapability {
    /** Read-only data access */
    READ = 'READ',
    /** Write/modify data */
    WRITE = 'WRITE',
    /** External API calls */
    EXTERNAL = 'EXTERNAL',
    /** User interaction */
    USER_INTERACTION = 'USER_INTERACTION',
    /** Sensitive operations */
    SENSITIVE = 'SENSITIVE',
    /** Computation only (no side effects) */
    PURE = 'PURE',
}

/**
 * Tool permission level.
 */
export enum ToolPermission {
    /** Always allowed */
    ALLOWED = 'ALLOWED',
    /** Requires confirmation */
    CONFIRM = 'CONFIRM',
    /** Requires approval */
    APPROVE = 'APPROVE',
    /** Never allowed (blocked) */
    BLOCKED = 'BLOCKED',
}

/**
 * Result of tool execution.
 */
export interface ToolResult<T> {
    /** Whether execution succeeded */
    success: boolean;
    /** Result data if successful */
    data?: T;
    /** Error if failed */
    error?: ToolError;
    /** Execution duration */
    durationMs: number;
    /** Token usage (if applicable) */
    tokenUsage?: {
        input: number;
        output: number;
    };
}

/**
 * Tool error structure.
 */
export interface ToolError {
    /** Error code */
    code: string;
    /** Human-readable message */
    message: string;
    /** Whether the error is retryable */
    retryable: boolean;
    /** Suggested action */
    suggestion?: string;
    /** Original error */
    cause?: Error;
}

/**
 * Tool metadata.
 */
export interface ToolMetadata {
    /** Unique tool identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description for agent prompts */
    description: string;
    /** Detailed usage instructions */
    usageHint: string;
    /** Version */
    version: string;
    /** Required capabilities */
    capabilities: ToolCapability[];
    /** Default permission level */
    defaultPermission: ToolPermission;
    /** Estimated cost per call in cents */
    estimatedCostCents: number;
    /** Estimated latency in ms */
    estimatedLatencyMs: number;
    /** Rate limit (calls per minute) */
    rateLimit?: number;
    /** Whether tool is enabled */
    enabled: boolean;
}

/**
 * Tool contract definition.
 */
export interface ToolContract<TInput, TOutput> {
    /** Tool metadata */
    metadata: ToolMetadata;
    /** Input schema */
    inputSchema: ZodSchema<TInput>;
    /** Output schema */
    outputSchema: ZodSchema<TOutput>;
    /** Execute the tool */
    execute(input: TInput, context: ToolExecutionContext): Promise<ToolResult<TOutput>>;
}

/**
 * Tool execution context.
 */
export interface ToolExecutionContext {
    /** User ID */
    userId: string;
    /** Session ID */
    sessionId: string;
    /** Agent ID requesting tool */
    agentId: string;
    /** Request ID for tracing */
    requestId: string;
    /** Permissions for this context */
    permissions: Map<string, ToolPermission>;
    /** Whether dry-run mode */
    dryRun: boolean;
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * Central registry for all tools.
 * 
 * Usage:
 * ```typescript
 * const registry = new ToolRegistry();
 * 
 * // Register a tool
 * registry.register({
 *   metadata: {
 *     id: 'retrieve-memories',
 *     name: 'Retrieve Memories',
 *     description: 'Search for past memories',
 *     ...
 *   },
 *   inputSchema: z.object({ query: z.string() }),
 *   outputSchema: z.array(MemorySchema),
 *   execute: async (input) => { ... },
 * });
 * 
 * // Execute with validation
 * const result = await registry.execute('retrieve-memories', { query: 'summer' }, context);
 * ```
 */
export class ToolRegistry {
    private tools: Map<string, ToolContract<unknown, unknown>> = new Map();
    private executionLog: ToolExecutionLogEntry[] = [];
    private usageCounters: Map<string, { count: number; windowStart: number }> = new Map();

    /**
     * Register a tool.
     */
    register<TInput, TOutput>(contract: ToolContract<TInput, TOutput>): void {
        if (this.tools.has(contract.metadata.id)) {
            console.warn(`[ToolRegistry] Overwriting tool: ${contract.metadata.id}`);
        }
        this.tools.set(contract.metadata.id, contract as ToolContract<unknown, unknown>);
    }

    /**
     * Unregister a tool.
     */
    unregister(toolId: string): boolean {
        return this.tools.delete(toolId);
    }

    /**
     * Get a tool contract.
     */
    get<TInput, TOutput>(toolId: string): ToolContract<TInput, TOutput> | undefined {
        return this.tools.get(toolId) as ToolContract<TInput, TOutput> | undefined;
    }

    /**
     * Check if a tool exists.
     */
    has(toolId: string): boolean {
        return this.tools.has(toolId);
    }

    /**
     * List all tool metadata.
     */
    listTools(): ToolMetadata[] {
        return Array.from(this.tools.values()).map((t) => t.metadata);
    }

    /**
     * List enabled tools.
     */
    listEnabled(): ToolMetadata[] {
        return this.listTools().filter((t) => t.enabled);
    }

    /**
     * List tools by capability.
     */
    listByCapability(capability: ToolCapability): ToolMetadata[] {
        return this.listTools().filter((t) => t.capabilities.includes(capability));
    }

    /**
     * Generate tool descriptions for agent prompts.
     */
    generateToolDescriptions(): string {
        return this.listEnabled()
            .map((t) => `${t.name} (${t.id}): ${t.description}\n  Usage: ${t.usageHint}`)
            .join('\n\n');
    }

    // ============================================================================
    // Execution
    // ============================================================================

    /**
     * Execute a tool with full validation and logging.
     */
    async execute<TInput, TOutput>(
        toolId: string,
        input: TInput,
        context: ToolExecutionContext
    ): Promise<ToolResult<TOutput>> {
        const startTime = Date.now();
        const contract = this.tools.get(toolId);

        // Check tool exists
        if (!contract) {
            return this.createErrorResult<TOutput>('TOOL_NOT_FOUND', `Tool not found: ${toolId}`, false, startTime);
        }

        // Check tool is enabled
        if (!contract.metadata.enabled) {
            return this.createErrorResult<TOutput>('TOOL_DISABLED', `Tool is disabled: ${toolId}`, false, startTime);
        }

        // Check permissions
        const permission = this.getPermission(toolId, context);
        if (permission === ToolPermission.BLOCKED) {
            return this.createErrorResult<TOutput>('PERMISSION_DENIED', `Permission denied for tool: ${toolId}`, false, startTime);
        }

        // Check rate limit
        if (!this.checkRateLimit(toolId, contract.metadata.rateLimit)) {
            return this.createErrorResult<TOutput>('RATE_LIMIT', `Rate limit exceeded for tool: ${toolId}`, true, startTime);
        }

        // Validate input
        const inputValidation = this.validateInput(contract, input);
        if (!inputValidation.success) {
            return this.createErrorResult<TOutput>(
                'INVALID_INPUT',
                `Invalid input: ${inputValidation.error}`,
                false,
                startTime
            );
        }

        // Dry run check
        if (context.dryRun) {
            return {
                success: true,
                data: undefined,
                durationMs: Date.now() - startTime,
            };
        }

        // Execute
        try {
            const result = await contract.execute(input, context);

            // Validate output
            if (result.success && result.data) {
                const outputValidation = this.validateOutput(contract, result.data);
                if (!outputValidation.success) {
                    console.warn(`[ToolRegistry] Output validation failed for ${toolId}:`, outputValidation.error);
                }
            }

            // Log execution
            this.logExecution(toolId, input, result, context, Date.now() - startTime);

            return result as ToolResult<TOutput>;
        } catch (error) {
            const result = this.createErrorResult<TOutput>(
                'EXECUTION_ERROR',
                `Tool execution failed: ${(error as Error).message}`,
                true,
                startTime,
                error as Error
            );
            this.logExecution(toolId, input, result, context, Date.now() - startTime);
            return result;
        }
    }

    /**
     * Validate input against schema.
     */
    private validateInput(
        contract: ToolContract<unknown, unknown>,
        input: unknown
    ): { success: boolean; error?: string } {
        try {
            contract.inputSchema.parse(input);
            return { success: true };
        } catch (error) {
            if (error instanceof ZodError) {
                return { success: false, error: error.issues.map((e: { message: string }) => e.message).join(', ') };
            }
            return { success: false, error: 'Unknown validation error' };
        }
    }

    /**
     * Validate output against schema.
     */
    private validateOutput(
        contract: ToolContract<unknown, unknown>,
        output: unknown
    ): { success: boolean; error?: string } {
        try {
            contract.outputSchema.parse(output);
            return { success: true };
        } catch (error) {
            if (error instanceof ZodError) {
                return { success: false, error: error.issues.map((e: { message: string }) => e.message).join(', ') };
            }
            return { success: false, error: 'Unknown validation error' };
        }
    }

    /**
     * Get permission for a tool in context.
     */
    private getPermission(toolId: string, context: ToolExecutionContext): ToolPermission {
        // Check context-specific permissions first
        if (context.permissions.has(toolId)) {
            return context.permissions.get(toolId)!;
        }

        // Fall back to default permission
        const contract = this.tools.get(toolId);
        return contract?.metadata.defaultPermission || ToolPermission.BLOCKED;
    }

    /**
     * Check rate limit.
     */
    private checkRateLimit(toolId: string, limit?: number): boolean {
        if (!limit) return true;

        const now = Date.now();
        const windowMs = 60000; // 1 minute window

        let counter = this.usageCounters.get(toolId);
        if (!counter || now - counter.windowStart > windowMs) {
            counter = { count: 0, windowStart: now };
        }

        if (counter.count >= limit) {
            return false;
        }

        counter.count++;
        this.usageCounters.set(toolId, counter);
        return true;
    }

    /**
     * Create an error result.
     */
    private createErrorResult<T>(
        code: string,
        message: string,
        retryable: boolean,
        startTime: number,
        cause?: Error
    ): ToolResult<T> {
        return {
            success: false,
            error: { code, message, retryable, cause },
            durationMs: Date.now() - startTime,
        };
    }

    // ============================================================================
    // Logging
    // ============================================================================

    /**
     * Log a tool execution.
     */
    private logExecution(
        toolId: string,
        input: unknown,
        result: ToolResult<unknown>,
        context: ToolExecutionContext,
        durationMs: number
    ): void {
        const entry: ToolExecutionLogEntry = {
            timestamp: Date.now(),
            toolId,
            userId: context.userId,
            sessionId: context.sessionId,
            agentId: context.agentId,
            requestId: context.requestId,
            inputSummary: this.summarizeInput(input),
            success: result.success,
            errorCode: result.error?.code,
            durationMs,
        };

        this.executionLog.push(entry);

        // Keep log bounded
        if (this.executionLog.length > 1000) {
            this.executionLog = this.executionLog.slice(-500);
        }
    }

    /**
     * Summarize input for logging (avoid logging sensitive data).
     */
    private summarizeInput(input: unknown): string {
        if (input === null || input === undefined) return 'null';
        if (typeof input === 'string') return `string(${input.slice(0, 50)}...)`;
        if (typeof input === 'object') return `object(${Object.keys(input as Record<string, unknown>).join(', ')})`;
        return String(input);
    }

    /**
     * Get execution log.
     */
    getExecutionLog(filter?: { toolId?: string; userId?: string }): ToolExecutionLogEntry[] {
        let log = this.executionLog;
        if (filter?.toolId) {
            log = log.filter((e) => e.toolId === filter.toolId);
        }
        if (filter?.userId) {
            log = log.filter((e) => e.userId === filter.userId);
        }
        return log;
    }

    /**
     * Get tool statistics.
     */
    getStats(toolId: string): ToolStats | undefined {
        const entries = this.executionLog.filter((e) => e.toolId === toolId);
        if (entries.length === 0) return undefined;

        const successCount = entries.filter((e) => e.success).length;
        const durations = entries.map((e) => e.durationMs);

        return {
            toolId,
            totalCalls: entries.length,
            successRate: successCount / entries.length,
            averageLatencyMs: durations.reduce((a, b) => a + b, 0) / durations.length,
            p95LatencyMs: this.percentile(durations, 95),
            lastUsed: Math.max(...entries.map((e) => e.timestamp)),
        };
    }

    /**
     * Calculate percentile.
     */
    private percentile(values: number[], p: number): number {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
}

/**
 * Tool execution log entry.
 */
export interface ToolExecutionLogEntry {
    timestamp: number;
    toolId: string;
    userId: string;
    sessionId: string;
    agentId: string;
    requestId: string;
    inputSummary: string;
    success: boolean;
    errorCode?: string;
    durationMs: number;
}

/**
 * Tool statistics.
 */
export interface ToolStats {
    toolId: string;
    totalCalls: number;
    successRate: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    lastUsed: number;
}

// ============================================================================
// Built-in Schemas
// ============================================================================

/**
 * Common schemas for tool contracts.
 */
export const CommonSchemas = {
    /** String query input */
    QueryInput: z.object({
        query: z.string().min(1).max(1000),
    }),

    /** Memory result */
    MemoryResult: z.object({
        id: z.string(),
        text: z.string(),
        score: z.number(),
        metadata: z.record(z.string(), z.unknown()).optional(),
    }),

    /** Safety check input */
    SafetyInput: z.object({
        text: z.string(),
    }),

    /** Safety check result */
    SafetyResult: z.object({
        isSafe: z.boolean(),
        riskLevel: z.enum(['none', 'low', 'medium', 'high']),
        reason: z.string().optional(),
    }),

    /** Generic text result */
    TextResult: z.object({
        text: z.string(),
    }),
};
