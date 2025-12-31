/**
 * Metrics Collection - OpenTelemetry-compatible observability.
 * 
 * Provides application metrics for monitoring and alerting.
 * Design follows OpenTelemetry semantic conventions.
 * 
 * For production, export to:
 * - Prometheus
 * - Datadog
 * - New Relic
 * - Grafana Cloud
 * 
 * @module Metrics
 */

import { logger } from '../Logger';

// ============================================================================
// Types
// ============================================================================

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricLabels {
    [key: string]: string | number | boolean;
}

export interface MetricValue {
    value: number;
    labels: MetricLabels;
    timestamp: number;
}

export interface MetricDefinition {
    name: string;
    type: MetricType;
    description: string;
    unit?: string;
}

export interface HistogramBuckets {
    buckets: number[];
    counts: number[];
    sum: number;
    count: number;
}

// ============================================================================
// Metric Definitions (OpenTelemetry Semantic Conventions)
// ============================================================================

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
    // HTTP Metrics
    'http.server.request.duration': {
        name: 'http.server.request.duration',
        type: 'histogram',
        description: 'Duration of HTTP server requests',
        unit: 'ms',
    },
    'http.server.request.count': {
        name: 'http.server.request.count',
        type: 'counter',
        description: 'Total number of HTTP requests',
    },
    'http.server.active_requests': {
        name: 'http.server.active_requests',
        type: 'gauge',
        description: 'Number of active HTTP requests',
    },

    // LLM Metrics
    'llm.request.duration': {
        name: 'llm.request.duration',
        type: 'histogram',
        description: 'Duration of LLM API calls',
        unit: 'ms',
    },
    'llm.tokens.total': {
        name: 'llm.tokens.total',
        type: 'counter',
        description: 'Total tokens used',
    },
    'llm.cost.cents': {
        name: 'llm.cost.cents',
        type: 'counter',
        description: 'Total cost in cents',
        unit: 'cents',
    },
    'llm.request.count': {
        name: 'llm.request.count',
        type: 'counter',
        description: 'Total LLM requests',
    },
    'llm.request.errors': {
        name: 'llm.request.errors',
        type: 'counter',
        description: 'Total LLM request errors',
    },

    // Agent Metrics
    'agent.execution.duration': {
        name: 'agent.execution.duration',
        type: 'histogram',
        description: 'Duration of agent executions',
        unit: 'ms',
    },
    'agent.steps.total': {
        name: 'agent.steps.total',
        type: 'counter',
        description: 'Total agent steps executed',
    },
    'agent.halts.total': {
        name: 'agent.halts.total',
        type: 'counter',
        description: 'Total agent halts by reason',
    },

    // Session Metrics
    'session.active': {
        name: 'session.active',
        type: 'gauge',
        description: 'Number of active sessions',
    },
    'session.duration': {
        name: 'session.duration',
        type: 'histogram',
        description: 'Session duration',
        unit: 'seconds',
    },

    // Safety Metrics
    'safety.alerts.total': {
        name: 'safety.alerts.total',
        type: 'counter',
        description: 'Total safety alerts triggered',
    },
    'hallucination.checks.total': {
        name: 'hallucination.checks.total',
        type: 'counter',
        description: 'Total hallucination checks',
    },
    'hallucination.detected.total': {
        name: 'hallucination.detected.total',
        type: 'counter',
        description: 'Total hallucinations detected',
    },

    // Rate Limiting Metrics
    'ratelimit.exceeded.total': {
        name: 'ratelimit.exceeded.total',
        type: 'counter',
        description: 'Total rate limit exceeded events',
    },
};

// ============================================================================
// Metrics Collector
// ============================================================================

/**
 * In-memory metrics collector.
 * 
 * For production, replace with OpenTelemetry SDK:
 * - @opentelemetry/sdk-metrics
 * - @opentelemetry/exporter-prometheus
 */
export class MetricsCollector {
    private static instance: MetricsCollector;
    private counters: Map<string, Map<string, number>> = new Map();
    private gauges: Map<string, Map<string, number>> = new Map();
    private histograms: Map<string, Map<string, number[]>> = new Map();
    private exportInterval: NodeJS.Timeout | null = null;

    private constructor() {
        // Export metrics every 60 seconds
        if (process.env.NODE_ENV !== 'test') {
            this.exportInterval = setInterval(() => this.exportMetrics(), 60000);
        }
    }

    static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }

    // ============================================================================
    // Counter Operations
    // ============================================================================

    /**
     * Increment a counter.
     */
    increment(name: string, labels: MetricLabels = {}, delta: number = 1): void {
        const labelKey = this.labelsToKey(labels);

        if (!this.counters.has(name)) {
            this.counters.set(name, new Map());
        }

        const counter = this.counters.get(name)!;
        const current = counter.get(labelKey) || 0;
        counter.set(labelKey, current + delta);
    }

    /**
     * Get counter value.
     */
    getCounter(name: string, labels: MetricLabels = {}): number {
        const labelKey = this.labelsToKey(labels);
        return this.counters.get(name)?.get(labelKey) || 0;
    }

    // ============================================================================
    // Gauge Operations
    // ============================================================================

    /**
     * Set a gauge value.
     */
    setGauge(name: string, value: number, labels: MetricLabels = {}): void {
        const labelKey = this.labelsToKey(labels);

        if (!this.gauges.has(name)) {
            this.gauges.set(name, new Map());
        }

        this.gauges.get(name)!.set(labelKey, value);
    }

    /**
     * Increment a gauge.
     */
    incGauge(name: string, delta: number = 1, labels: MetricLabels = {}): void {
        const labelKey = this.labelsToKey(labels);

        if (!this.gauges.has(name)) {
            this.gauges.set(name, new Map());
        }

        const gauge = this.gauges.get(name)!;
        const current = gauge.get(labelKey) || 0;
        gauge.set(labelKey, current + delta);
    }

    /**
     * Decrement a gauge.
     */
    decGauge(name: string, delta: number = 1, labels: MetricLabels = {}): void {
        this.incGauge(name, -delta, labels);
    }

    /**
     * Get gauge value.
     */
    getGauge(name: string, labels: MetricLabels = {}): number {
        const labelKey = this.labelsToKey(labels);
        return this.gauges.get(name)?.get(labelKey) || 0;
    }

    // ============================================================================
    // Histogram Operations
    // ============================================================================

    /**
     * Record a histogram observation.
     */
    observe(name: string, value: number, labels: MetricLabels = {}): void {
        const labelKey = this.labelsToKey(labels);

        if (!this.histograms.has(name)) {
            this.histograms.set(name, new Map());
        }

        const histogram = this.histograms.get(name)!;
        if (!histogram.has(labelKey)) {
            histogram.set(labelKey, []);
        }

        const values = histogram.get(labelKey)!;
        values.push(value);

        // Keep only last 1000 observations per label set
        if (values.length > 1000) {
            values.shift();
        }
    }

    /**
     * Get histogram statistics.
     */
    getHistogram(name: string, labels: MetricLabels = {}): {
        count: number;
        sum: number;
        min: number;
        max: number;
        avg: number;
        p50: number;
        p95: number;
        p99: number;
    } | null {
        const labelKey = this.labelsToKey(labels);
        const values = this.histograms.get(name)?.get(labelKey);

        if (!values || values.length === 0) {
            return null;
        }

        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count: values.length,
            sum,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: sum / values.length,
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
        };
    }

    // ============================================================================
    // Timing Helper
    // ============================================================================

    /**
     * Time an operation and record to histogram.
     */
    async time<T>(
        name: string,
        operation: () => Promise<T>,
        labels: MetricLabels = {}
    ): Promise<T> {
        const start = Date.now();
        try {
            const result = await operation();
            this.observe(name, Date.now() - start, { ...labels, status: 'success' });
            return result;
        } catch (error) {
            this.observe(name, Date.now() - start, { ...labels, status: 'error' });
            throw error;
        }
    }

    // ============================================================================
    // Export
    // ============================================================================

    /**
     * Export metrics (logs for now, replace with OTLP exporter in production).
     */
    private exportMetrics(): void {
        const metrics: any = {
            timestamp: new Date().toISOString(),
            counters: {},
            gauges: {},
            histograms: {},
        };

        // Export counters
        for (const [name, values] of this.counters.entries()) {
            metrics.counters[name] = Object.fromEntries(values);
        }

        // Export gauges
        for (const [name, values] of this.gauges.entries()) {
            metrics.gauges[name] = Object.fromEntries(values);
        }

        // Export histogram summaries
        for (const [name, labeledValues] of this.histograms.entries()) {
            metrics.histograms[name] = {};
            for (const [labels, values] of labeledValues.entries()) {
                if (values.length > 0) {
                    const sorted = [...values].sort((a, b) => a - b);
                    metrics.histograms[name][labels] = {
                        count: values.length,
                        sum: values.reduce((a, b) => a + b, 0),
                        p50: sorted[Math.floor(sorted.length * 0.5)],
                        p95: sorted[Math.floor(sorted.length * 0.95)],
                    };
                }
            }
        }

        // Log metrics (in production, send to observability platform)
        if (Object.keys(metrics.counters).length > 0 ||
            Object.keys(metrics.gauges).length > 0 ||
            Object.keys(metrics.histograms).length > 0) {
            logger.debug('Metrics export', metrics);
        }
    }

    /**
     * Get all metrics as Prometheus-compatible text.
     */
    toPrometheusFormat(): string {
        const lines: string[] = [];

        // Counters
        for (const [name, values] of this.counters.entries()) {
            const def = METRIC_DEFINITIONS[name];
            if (def) {
                lines.push(`# HELP ${name} ${def.description}`);
                lines.push(`# TYPE ${name} counter`);
            }
            for (const [labels, value] of values.entries()) {
                const labelStr = labels ? `{${labels}}` : '';
                lines.push(`${name}${labelStr} ${value}`);
            }
        }

        // Gauges
        for (const [name, values] of this.gauges.entries()) {
            const def = METRIC_DEFINITIONS[name];
            if (def) {
                lines.push(`# HELP ${name} ${def.description}`);
                lines.push(`# TYPE ${name} gauge`);
            }
            for (const [labels, value] of values.entries()) {
                const labelStr = labels ? `{${labels}}` : '';
                lines.push(`${name}${labelStr} ${value}`);
            }
        }

        return lines.join('\n');
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    private labelsToKey(labels: MetricLabels): string {
        if (Object.keys(labels).length === 0) return '';
        return Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
    }

    /**
     * Reset all metrics (for testing).
     */
    reset(): void {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

const metrics = MetricsCollector.getInstance();

export const recordHttpRequest = (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
) => {
    metrics.increment('http.server.request.count', { method, path, status: statusCode });
    metrics.observe('http.server.request.duration', durationMs, { method, path });
};

export const recordLLMRequest = (
    model: string,
    provider: string,
    tokens: number,
    costCents: number,
    durationMs: number,
    success: boolean
) => {
    const labels = { model, provider };
    metrics.increment('llm.request.count', labels);
    metrics.increment('llm.tokens.total', labels, tokens);
    metrics.increment('llm.cost.cents', labels, costCents);
    metrics.observe('llm.request.duration', durationMs, labels);
    if (!success) {
        metrics.increment('llm.request.errors', labels);
    }
};

export const recordAgentExecution = (
    agentType: string,
    steps: number,
    durationMs: number,
    haltReason?: string
) => {
    metrics.increment('agent.steps.total', { agent: agentType }, steps);
    metrics.observe('agent.execution.duration', durationMs, { agent: agentType });
    if (haltReason) {
        metrics.increment('agent.halts.total', { agent: agentType, reason: haltReason });
    }
};

export const recordSafetyAlert = (severity: string) => {
    metrics.increment('safety.alerts.total', { severity });
};

export const recordRateLimitExceeded = (endpoint: string) => {
    metrics.increment('ratelimit.exceeded.total', { endpoint });
};

export { metrics };
