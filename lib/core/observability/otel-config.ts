/**
 * OpenTelemetry Configuration
 * 
 * Configures distributed tracing with OTEL SDK.
 * Exports spans to console in development, OTLP endpoint in production.
 * 
 * @module otel-config
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import {
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-node';
import {
    context,
    trace,
    metrics,
    SpanKind,
    SpanStatusCode,
    type Span as OtelSpan,
    type Tracer,
} from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// ============================================================================
// Configuration Types
// ============================================================================

export interface OtelConfig {
    serviceName: string;
    serviceVersion: string;
    environment: string;
    otlpEndpoint?: string;
    prometheusPort?: number;
    enableConsoleExporter?: boolean;
    samplingRatio?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: OtelConfig = {
    serviceName: 'evermore',
    serviceVersion: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    prometheusPort: Number(process.env.PROMETHEUS_PORT) || 9464,
    enableConsoleExporter: process.env.NODE_ENV === 'development',
    samplingRatio: 1.0,
};

// ============================================================================
// SDK Instance
// ============================================================================

let sdk: NodeSDK | null = null;
let isInitialized = false;
let prometheusExporter: PrometheusExporter | null = null;

/**
 * Initialize OpenTelemetry SDK.
 * 
 * Should be called once at application startup.
 * Safe to call multiple times (idempotent).
 */
export function initializeOtel(customConfig?: Partial<OtelConfig>): void {
    if (isInitialized) {
        return;
    }

    const config = { ...DEFAULT_CONFIG, ...customConfig };

    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
        console.log('[OTEL] Skipping initialization in test environment');
        isInitialized = true;
        return;
    }

    try {
        const resource = resourceFromAttributes({
            [ATTR_SERVICE_NAME]: config.serviceName,
            [ATTR_SERVICE_VERSION]: config.serviceVersion,
            'deployment.environment': config.environment,
        });

        // Configure span processors
        const spanProcessors = [];

        // Console exporter for development
        if (config.enableConsoleExporter) {
            spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
        }

        // OTLP exporter for production
        if (config.otlpEndpoint) {
            const otlpExporter = new OTLPTraceExporter({
                url: config.otlpEndpoint,
            });
            spanProcessors.push(new BatchSpanProcessor(otlpExporter));
        }

        // Configure Prometheus Exporter for Metrics
        prometheusExporter = new PrometheusExporter({
            port: config.prometheusPort,
        }, () => {
            console.log(`[OTEL] Prometheus metrics available at http://localhost:${config.prometheusPort}${PrometheusExporter.DEFAULT_OPTIONS.endpoint}`);
        });

        sdk = new NodeSDK({
            resource,
            instrumentations: [
                getNodeAutoInstrumentations({
                    // Disable noisy instrumentations
                    '@opentelemetry/instrumentation-fs': { enabled: false },
                    '@opentelemetry/instrumentation-dns': { enabled: false },
                    '@opentelemetry/instrumentation-net': { enabled: false },
                }),
            ],
            ...(spanProcessors.length > 0 && { spanProcessors }),
            metricReader: prometheusExporter,
        });

        sdk.start();
        isInitialized = true;

        console.log(`[OTEL] OpenTelemetry initialized for ${config.serviceName} (${config.environment})`);

        // Graceful shutdown
        process.on('SIGTERM', () => {
            sdk?.shutdown()
                .then(() => console.log('[OTEL] SDK shut down successfully'))
                .catch((error) => console.error('[OTEL] Error shutting down SDK:', error))
                .finally(() => process.exit(0));
        });
    } catch (error) {
        console.error('[OTEL] Failed to initialize:', error);
        isInitialized = true; // Prevent retry loops
    }
}

/**
 * Get the global tracer for the service.
 */
export function getTracer(name?: string): Tracer {
    return trace.getTracer(name || DEFAULT_CONFIG.serviceName);
}

/**
 * Get current active span.
 */
export function getCurrentSpan(): OtelSpan | undefined {
    return trace.getActiveSpan();
}

/**
 * Get current trace ID from active span.
 */
export function getCurrentTraceId(): string | undefined {
    const span = getCurrentSpan();
    if (span) {
        return span.spanContext().traceId;
    }
    return undefined;
}

// ============================================================================
// Span Helpers
// ============================================================================

export { SpanKind, SpanStatusCode, context, trace };
export type { OtelSpan, Tracer };

/**
 * Create a new span and execute a function within its context.
 */
export async function withOtelSpan<T>(
    name: string,
    fn: (span: OtelSpan) => Promise<T>,
    options?: {
        kind?: SpanKind;
        attributes?: Record<string, string | number | boolean>;
    }
): Promise<T> {
    const tracer = getTracer();

    return tracer.startActiveSpan(
        name,
        {
            kind: options?.kind || SpanKind.INTERNAL,
            attributes: options?.attributes,
        },
        async (span) => {
            try {
                const result = await fn(span);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error instanceof Error ? error.message : String(error),
                });
                if (error instanceof Error) {
                    span.recordException(error);
                }
                throw error;
            } finally {
                span.end();
            }
        }
    );
}

/**
 * Start a span manually (remember to end it).
 */
export function startOtelSpan(
    name: string,
    options?: {
        kind?: SpanKind;
        attributes?: Record<string, string | number | boolean>;
    }
): OtelSpan {
    const tracer = getTracer();
    return tracer.startSpan(name, {
        kind: options?.kind || SpanKind.INTERNAL,
        attributes: options?.attributes,
    });
}

/**
 * Add attributes to the current span.
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = getCurrentSpan();
    if (span) {
        span.setAttributes(attributes);
    }
}

/**
 * Record an event in the current span.
 */
export function recordSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = getCurrentSpan();
    if (span) {
        span.addEvent(name, attributes);
    }
}

/**
 * Check if OTEL is initialized.
 */
export function isOtelInitialized(): boolean {
    return isInitialized;
}
/**
 * Get the Prometheus exporter instance.
 */
export function getPrometheusExporter(): PrometheusExporter | null {
    return prometheusExporter;
}

/**
 * Get metrics in Prometheus format.
 */
export async function getPrometheusMetrics(): Promise<string> {
    if (!prometheusExporter) {
        return '# Prometheus exporter not initialized';
    }

    // In @opentelemetry/exporter-prometheus v0.x, we might need a different way to get the response
    // If it's v1.x+, it has getMetricsRequestHandler
    // For now, if it's already running a server, we can try to fetch from it or use internal state

    // Attempt to use the internal handler's logic if possible
    // Version 0.208.0 is very old, it might just be better to fetch from local port
    try {
        const port = DEFAULT_CONFIG.prometheusPort;
        const response = await fetch(`http://localhost:${port}${PrometheusExporter.DEFAULT_OPTIONS.endpoint}`);
        return await response.text();
    } catch (e) {
        return `# Error fetching metrics: ${e instanceof Error ? e.message : String(e)}`;
    }
}
