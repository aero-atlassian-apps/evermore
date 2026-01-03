/**
 * Metrics Collection - OpenTelemetry-backed observability.
 * 
 * Provides application metrics for monitoring and alerting.
 * Design follows OpenTelemetry semantic conventions.
 * 
 * @module Metrics
 */

import { logger } from '../Logger';
import { metrics as otelMetrics, ValueType } from '@opentelemetry/api';

// ============================================================================
// Types
// ============================================================================

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricLabels {
    [key: string]: string | number | boolean;
}

export interface MetricDefinition {
    name: string;
    type: MetricType;
    description: string;
    unit?: string;
}

// ============================================================================
// Metrics Collector
// ============================================================================

/**
 * Production-grade metrics collector bridging to OpenTelemetry.
 */
export class MetricsCollector {
    private static instance: MetricsCollector;
    private meter = otelMetrics.getMeter('evermore-app');

    private counters: Map<string, any> = new Map();
    private gauges: Map<string, any> = new Map();
    private histograms: Map<string, any> = new Map();

    // Internal state for dashboard (Legacy compatibility)
    private counterValues: Map<string, number> = new Map();
    private histogramValues: Map<string, number[]> = new Map();

    private constructor() {
        console.log('[Metrics] Initialized production OTEL bridge');
    }

    static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }

    // ============================================================================
    // Instrument Getters (Lazy initialization)
    // ============================================================================

    private getCounterInstrument(name: string, description?: string, unit?: string) {
        if (!this.counters.has(name)) {
            const counter = this.meter.createCounter(name, {
                description: description || 'No description',
                unit: unit || '1',
                valueType: ValueType.INT,
            });
            this.counters.set(name, counter);
        }
        return this.counters.get(name);
    }

    private getHistogramInstrument(name: string, description?: string, unit?: string) {
        if (!this.histograms.has(name)) {
            const histogram = this.meter.createHistogram(name, {
                description: description || 'No description',
                unit: unit || 'ms',
                valueType: ValueType.DOUBLE,
            });
            this.histograms.set(name, histogram);
        }
        return this.histograms.get(name);
    }

    // ============================================================================
    // Public API (Backward Compatible)
    // ============================================================================

    /**
     * Increment a counter.
     */
    increment(name: string, labels: MetricLabels = {}, delta: number = 1): void {
        try {
            const counter = this.getCounterInstrument(name);
            counter.add(delta, labels as any);

            // Internal state for dashboard
            const current = this.counterValues.get(name) || 0;
            this.counterValues.set(name, current + delta);
        } catch (e) {
            logger.warn(`Failed to increment metric ${name}`, { e });
        }
    }

    /**
     * Set a gauge value.
     */
    setGauge(name: string, value: number, labels: MetricLabels = {}): void {
        // Simple internal state tracking for gauge
        this.counterValues.set(name, value);
        this.increment(name, labels, 0); // Trigger OTEL if needed
    }

    /**
     * Record a histogram observation.
     */
    observe(name: string, value: number, labels: MetricLabels = {}): void {
        try {
            const histogram = this.getHistogramInstrument(name);
            histogram.record(value, labels as any);

            // Internal state for dashboard (cap at 1000 samples)
            const values = this.histogramValues.get(name) || [];
            values.push(value);
            if (values.length > 1000) values.shift();
            this.histogramValues.set(name, values);
        } catch (e) {
            logger.warn(`Failed to observe metric ${name}`, { e });
        }
    }

    /**
     * Get current counter value (Dashboard compatibility).
     */
    getCounter(name: string): number {
        return this.counterValues.get(name) || 0;
    }

    /**
     * Get histogram stats (Dashboard compatibility).
     */
    getHistogram(name: string) {
        const values = this.histogramValues.get(name) || [];
        if (values.length === 0) return null;

        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count: values.length,
            sum,
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            avg: sum / values.length,
        };
    }

    /**
     * Legacy helper to time operations.
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

    // Prometheus format is handled by the OTEL Prometheus Exporter automatically now.
    async toPrometheusFormat(): Promise<string> {
        try {
            const { getPrometheusMetrics } = await import('../../observability/otel-config');
            return await getPrometheusMetrics();
        } catch (e) {
            return `# Failed to load metrics: ${e instanceof Error ? e.message : String(e)}`;
        }
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

const metricsCollector = MetricsCollector.getInstance();

export const recordHttpRequest = (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
) => {
    metricsCollector.increment('http.server.request.count', { method, path, status: statusCode });
    metricsCollector.observe('http.server.request.duration', durationMs, { method, path });
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
    metricsCollector.increment('llm.request.count', labels);
    metricsCollector.increment('llm.tokens.total', labels, tokens);
    metricsCollector.increment('llm.cost.cents', labels, costCents);
    metricsCollector.observe('llm.request.duration', durationMs, labels);
    if (!success) {
        metricsCollector.increment('llm.request.errors', labels);
    }
};

export const recordAgentExecution = (
    agentType: string,
    steps: number,
    durationMs: number,
    haltReason?: string
) => {
    metricsCollector.increment('agent.steps.total', { agent: agentType }, steps);
    metricsCollector.observe('agent.execution.duration', durationMs, { agent: agentType });
    if (haltReason) {
        metricsCollector.increment('agent.halts.total', { agent: agentType, reason: haltReason });
    }
};

export const recordSafetyAlert = (severity: string) => {
    metricsCollector.increment('safety.alerts.total', { severity });
};

export const recordRateLimitExceeded = (endpoint: string) => {
    metricsCollector.increment('ratelimit.exceeded.total', { endpoint });
};

export { metricsCollector as metrics };
