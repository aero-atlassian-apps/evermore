/**
 * Enhanced Agent Tracer - Structured tracing with OpenTelemetry compatibility.
 * 
 * Provides comprehensive observability for agent execution including
 * spans, events, metrics, and export capabilities.
 * 
 * @module EnhancedAgentTracer
 */

import { AgentStep } from './types';
import { AgentPhase, HaltReason } from './primitives/AgentPrimitives';

// ============================================================================
// Trace Types
// ============================================================================

/**
 * Status of a span.
 */
export type SpanStatus = 'OK' | 'ERROR' | 'UNSET';

/**
 * A trace span representing a unit of work.
 */
export interface TraceSpan {
    /** Unique span ID */
    id: string;
    /** Parent span ID (if nested) */
    parentId?: string;
    /** Trace ID (groups all spans for one run) */
    traceId: string;
    /** Span name */
    name: string;
    /** Start time (epoch ms) */
    startTime: number;
    /** End time (epoch ms) */
    endTime?: number;
    /** Duration in milliseconds */
    durationMs?: number;
    /** Span attributes */
    attributes: Record<string, string | number | boolean>;
    /** Events within this span */
    events: TraceEvent[];
    /** Final status */
    status: SpanStatus;
    /** Error message if status is ERROR */
    errorMessage?: string;
    /** Child span IDs */
    childIds: string[];
}

/**
 * An event within a span.
 */
export interface TraceEvent {
    /** Event name */
    name: string;
    /** Timestamp (epoch ms) */
    timestamp: number;
    /** Event attributes */
    attributes: Record<string, string | number | boolean>;
}

/**
 * Token usage record.
 */
export interface TokenUsageRecord {
    /** Span ID this usage belongs to */
    spanId: string;
    /** Input tokens */
    inputTokens: number;
    /** Output tokens */
    outputTokens: number;
    /** Model used */
    model: string;
    /** Timestamp */
    timestamp: number;
}

/**
 * Cost record.
 */
export interface CostRecord {
    /** Span ID */
    spanId: string;
    /** Cost in cents */
    costCents: number;
    /** Model used */
    model: string;
    /** Reason/category */
    category: string;
    /** Timestamp */
    timestamp: number;
}

/**
 * State transition record.
 */
export interface TransitionRecord {
    /** From state */
    from: AgentPhase;
    /** To state */
    to: AgentPhase;
    /** Trigger */
    trigger: string;
    /** Timestamp */
    timestamp: number;
    /** Duration in previous state */
    durationInPreviousMs: number;
}

/**
 * Complete trace for an agent run.
 */
export interface AgentTrace {
    /** Trace ID */
    traceId: string;
    /** Session ID */
    sessionId: string;
    /** User ID */
    userId: string;
    /** Goal */
    goal: string;
    /** Start time */
    startTime: number;
    /** End time */
    endTime?: number;
    /** Total duration */
    durationMs?: number;
    /** All spans */
    spans: TraceSpan[];
    /** All agent steps */
    steps: AgentStep[];
    /** Token usage records */
    tokenUsage: TokenUsageRecord[];
    /** Cost records */
    costs: CostRecord[];
    /** State transitions */
    transitions: TransitionRecord[];
    /** Final result */
    result?: {
        success: boolean;
        finalAnswer?: string;
        haltReason?: HaltReason;
    };
    /** Evaluation result */
    evaluation?: any;
    /** Totals */
    totals: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        costCents: number;
        stepCount: number;
        spanCount: number;
        eventCount: number;
    };
}

/**
 * Context for creating spans.
 */
export interface SpanContext {
    spanId: string;
    traceId: string;
}

/**
 * OpenTelemetry-compatible span format.
 */
export interface OTelSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    kind: 'INTERNAL' | 'CLIENT' | 'SERVER';
    startTimeUnixNano: string;
    endTimeUnixNano: string;
    attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string; boolValue?: boolean } }>;
    events: Array<{
        timeUnixNano: string;
        name: string;
        attributes: Array<{ key: string; value: { stringValue?: string } }>;
    }>;
    status: { code: 'STATUS_CODE_OK' | 'STATUS_CODE_ERROR' | 'STATUS_CODE_UNSET'; message?: string };
}

// ============================================================================
// Enhanced Agent Tracer
// ============================================================================

/**
 * Enhanced tracer for agent execution with OpenTelemetry compatibility.
 * 
 * Usage:
 * ```typescript
 * const tracer = new EnhancedAgentTracer(sessionId, userId, goal);
 * 
 * const spanCtx = tracer.startSpan('intent_recognition', { model: 'gemini' });
 * tracer.recordEvent('llm_call_start', { prompt_tokens: 100 });
 * tracer.recordTokenUsage(100, 50, 'gemini-1.5-pro');
 * tracer.endSpan('OK');
 * 
 * const trace = tracer.getTrace();
 * const otelSpans = tracer.exportOTel();
 * ```
 */
export class EnhancedAgentTracer {
    private traceId: string;
    private sessionId: string;
    private userId: string;
    private goal: string;
    private startTime: number;
    private endTime?: number;

    private spans: Map<string, TraceSpan> = new Map();
    private spanStack: string[] = [];
    private steps: AgentStep[] = [];
    private tokenUsage: TokenUsageRecord[] = [];
    private costs: CostRecord[] = [];
    private transitions: TransitionRecord[] = [];
    private lastTransitionTime: number;
    private lastState: AgentPhase = AgentPhase.IDLE;

    constructor(sessionId: string, userId: string, goal: string) {
        this.traceId = this.generateId();
        this.sessionId = sessionId;
        this.userId = userId;
        this.goal = goal;
        this.startTime = Date.now();
        this.lastTransitionTime = this.startTime;
    }

    /**
     * Generate a random ID.
     */
    private generateId(): string {
        return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // ============================================================================
    // Span Management
    // ============================================================================

    /**
     * Start a new span.
     */
    startSpan(name: string, attributes: Record<string, string | number | boolean> = {}): SpanContext {
        const spanId = this.generateId();
        const parentId = this.spanStack.length > 0 ? this.spanStack[this.spanStack.length - 1] : undefined;

        const span: TraceSpan = {
            id: spanId,
            parentId,
            traceId: this.traceId,
            name,
            startTime: Date.now(),
            attributes: {
                'session.id': this.sessionId,
                'user.id': this.userId,
                ...attributes,
            },
            events: [],
            status: 'UNSET',
            childIds: [],
        };

        this.spans.set(spanId, span);
        this.spanStack.push(spanId);

        // Add to parent's children
        if (parentId) {
            const parent = this.spans.get(parentId);
            if (parent) {
                parent.childIds.push(spanId);
            }
        }

        return { spanId, traceId: this.traceId };
    }

    /**
     * End the current span.
     */
    endSpan(status: SpanStatus = 'OK', errorMessage?: string): void {
        const spanId = this.spanStack.pop();
        if (!spanId) {
            console.warn('[EnhancedAgentTracer] No span to end');
            return;
        }

        const span = this.spans.get(spanId);
        if (!span) {
            console.warn('[EnhancedAgentTracer] Span not found:', spanId);
            return;
        }

        span.endTime = Date.now();
        span.durationMs = span.endTime - span.startTime;
        span.status = status;
        span.errorMessage = errorMessage;
    }

    /**
     * Get the current span ID.
     */
    getCurrentSpanId(): string | undefined {
        return this.spanStack.length > 0 ? this.spanStack[this.spanStack.length - 1] : undefined;
    }

    /**
     * Add an attribute to the current span.
     */
    setSpanAttribute(key: string, value: string | number | boolean): void {
        const spanId = this.getCurrentSpanId();
        if (!spanId) return;

        const span = this.spans.get(spanId);
        if (span) {
            span.attributes[key] = value;
        }
    }

    // ============================================================================
    // Event Recording
    // ============================================================================

    /**
     * Record an event in the current span.
     */
    recordEvent(name: string, attributes: Record<string, string | number | boolean> = {}): void {
        const spanId = this.getCurrentSpanId();
        if (!spanId) {
            console.warn('[EnhancedAgentTracer] No span for event:', name);
            return;
        }

        const span = this.spans.get(spanId);
        if (!span) return;

        span.events.push({
            name,
            timestamp: Date.now(),
            attributes,
        });
    }

    /**
     * Log an agent step.
     */
    logStep(step: AgentStep): void {
        this.steps.push(step);

        // Also record as event
        this.recordEvent('agent_step', {
            thought: (step.thought || '').substring(0, 100),
            action: step.action,
            hasObservation: !!step.observation,
        });
    }

    // ============================================================================
    // Metrics Recording
    // ============================================================================

    /**
     * Record token usage.
     */
    recordTokenUsage(inputTokens: number, outputTokens: number, model: string): void {
        const spanId = this.getCurrentSpanId() || 'root';

        this.tokenUsage.push({
            spanId,
            inputTokens,
            outputTokens,
            model,
            timestamp: Date.now(),
        });

        // Also add as span attribute
        this.setSpanAttribute('llm.input_tokens', inputTokens);
        this.setSpanAttribute('llm.output_tokens', outputTokens);
        this.setSpanAttribute('llm.model', model);
    }

    /**
     * Record cost.
     */
    recordCost(costCents: number, model: string, category: string = 'llm'): void {
        const spanId = this.getCurrentSpanId() || 'root';

        this.costs.push({
            spanId,
            costCents,
            model,
            category,
            timestamp: Date.now(),
        });

        this.setSpanAttribute('cost.cents', costCents);
    }

    /**
     * Record a state transition.
     */
    logTransition(from: AgentPhase, to: AgentPhase, trigger: string): void {
        const now = Date.now();

        this.transitions.push({
            from,
            to,
            trigger,
            timestamp: now,
            durationInPreviousMs: now - this.lastTransitionTime,
        });

        this.lastTransitionTime = now;
        this.lastState = to;

        // Record as event
        this.recordEvent('state_transition', {
            from,
            to,
            trigger,
        });
    }

    // ============================================================================
    // Trace Finalization
    /**
     * Record an evaluation result.
     */
    recordEvaluation(evaluation: any): void {
        const spanId = this.getCurrentSpanId() || 'root';
        this.recordEvent('evaluation_completed', {
            score: evaluation.overallScore,
            passed: evaluation.passed,
        });

        // Add to current span attributes
        this.setSpanAttribute('evaluation.score', evaluation.overallScore);
        this.setSpanAttribute('evaluation.passed', evaluation.passed);
    }

    // ============================================================================

    /**
     * Finalize the trace with a result.
     */
    finalize(result: { success: boolean; finalAnswer?: string; haltReason?: HaltReason }): void {
        this.endTime = Date.now();

        // Close any open spans
        while (this.spanStack.length > 0) {
            this.endSpan(result.success ? 'OK' : 'ERROR');
        }
    }

    /**
     * Get the complete trace.
     */
    getTrace(): AgentTrace {
        const spans = Array.from(this.spans.values());

        // Calculate totals
        const totals = {
            inputTokens: this.tokenUsage.reduce((sum, t) => sum + t.inputTokens, 0),
            outputTokens: this.tokenUsage.reduce((sum, t) => sum + t.outputTokens, 0),
            totalTokens: this.tokenUsage.reduce((sum, t) => sum + t.inputTokens + t.outputTokens, 0),
            costCents: this.costs.reduce((sum, c) => sum + c.costCents, 0),
            stepCount: this.steps.length,
            spanCount: spans.length,
            eventCount: spans.reduce((sum, s) => sum + s.events.length, 0),
        };

        return {
            traceId: this.traceId,
            sessionId: this.sessionId,
            userId: this.userId,
            goal: this.goal,
            startTime: this.startTime,
            endTime: this.endTime,
            durationMs: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime,
            spans,
            steps: [...this.steps],
            tokenUsage: [...this.tokenUsage],
            costs: [...this.costs],
            transitions: [...this.transitions],
            totals,
        };
    }

    // ============================================================================
    // OpenTelemetry Export
    // ============================================================================

    /**
     * Export spans in OpenTelemetry format.
     */
    exportOTel(): OTelSpan[] {
        return Array.from(this.spans.values()).map((span): OTelSpan => ({
            traceId: span.traceId,
            spanId: span.id,
            parentSpanId: span.parentId,
            name: span.name,
            kind: 'INTERNAL',
            startTimeUnixNano: (span.startTime * 1_000_000).toString(),
            endTimeUnixNano: ((span.endTime || Date.now()) * 1_000_000).toString(),
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
                key,
                value: typeof value === 'string'
                    ? { stringValue: value }
                    : typeof value === 'number'
                        ? { intValue: value.toString() }
                        : { boolValue: value },
            })),
            events: span.events.map((event) => ({
                timeUnixNano: (event.timestamp * 1_000_000).toString(),
                name: event.name,
                attributes: Object.entries(event.attributes).map(([key, value]) => ({
                    key,
                    value: { stringValue: String(value) },
                })),
            })),
            status: {
                code: span.status === 'OK'
                    ? 'STATUS_CODE_OK'
                    : span.status === 'ERROR'
                        ? 'STATUS_CODE_ERROR'
                        : 'STATUS_CODE_UNSET',
                message: span.errorMessage,
            },
        }));
    }

    /**
     * Export as JSON string for logging.
     */
    exportJson(): string {
        return JSON.stringify(this.getTrace(), null, 2);
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * Get trace ID.
     */
    getTraceId(): string {
        return this.traceId;
    }

    /**
     * Get summary statistics.
     */
    getSummary(): string {
        const trace = this.getTrace();
        return [
            `Trace: ${trace.traceId}`,
            `Duration: ${trace.durationMs}ms`,
            `Steps: ${trace.totals.stepCount}`,
            `Tokens: ${trace.totals.totalTokens} (in: ${trace.totals.inputTokens}, out: ${trace.totals.outputTokens})`,
            `Cost: ${trace.totals.costCents}¢`,
            `Spans: ${trace.totals.spanCount}`,
            `Events: ${trace.totals.eventCount}`,
        ].join(' | ');
    }

    /**
     * Get token usage breakdown by model.
     */
    getTokensByModel(): Record<string, { input: number; output: number; total: number }> {
        const breakdown: Record<string, { input: number; output: number; total: number }> = {};

        for (const usage of this.tokenUsage) {
            if (!breakdown[usage.model]) {
                breakdown[usage.model] = { input: 0, output: 0, total: 0 };
            }
            breakdown[usage.model].input += usage.inputTokens;
            breakdown[usage.model].output += usage.outputTokens;
            breakdown[usage.model].total += usage.inputTokens + usage.outputTokens;
        }

        return breakdown;
    }

    /**
     * Get cost breakdown by category.
     */
    getCostsByCategory(): Record<string, number> {
        const breakdown: Record<string, number> = {};

        for (const cost of this.costs) {
            breakdown[cost.category] = (breakdown[cost.category] || 0) + cost.costCents;
        }

        return breakdown;
    }

    /**
     * Get average step duration.
     */
    getAverageStepDuration(): number | null {
        const stepSpans = Array.from(this.spans.values()).filter(
            (s) => s.name.includes('step') && s.durationMs !== undefined
        );

        if (stepSpans.length === 0) return null;

        const totalDuration = stepSpans.reduce((sum, s) => sum + (s.durationMs || 0), 0);
        return totalDuration / stepSpans.length;
    }
}
