/**
 * OpenTelemetry Tracing Utilities
 * 
 * Provides distributed tracing for production observability.
 * Instruments API routes, LLM calls, speech adapters, and database queries.
 * 
 * Now integrates with real OpenTelemetry SDK when available.
 * Falls back to in-memory spans for debugging when OTEL is not configured.
 * 
 * Usage:
 * ```typescript
 * import { withSpan, startSpan, getTraceId } from '@/lib/core/observability/tracing';
 * 
 * // Wrap async operations
 * const result = await withSpan('llm.generate', async (span) => {
 *   span.setAttribute('model', 'gemini-2.0');
 *   return await llm.generate(prompt);
 * });
 * 
 * // Manual span control
 * const span = startSpan('custom.operation');
 * try {
 *   // ... operation
 * } finally {
 *   span.end();
 * }
 * ```
 */

import { NextRequest } from 'next/server';
import {
    isOtelInitialized,
    getTracer,
    getCurrentTraceId,
    SpanKind,
    SpanStatusCode,
    type OtelSpan,
} from './otel-config';

// Types for span-like operations (compatible with OTEL when integrated)
export interface SpanAttributes {
    [key: string]: string | number | boolean | undefined;
}

export interface Span {
    setAttribute(key: string, value: string | number | boolean): void;
    setStatus(status: 'ok' | 'error', message?: string): void;
    recordException(error: Error): void;
    end(): void;
}

// In-memory span tracking (fallback when OTEL not available)
const activeSpans = new Map<string, { name: string; start: number; attributes: SpanAttributes }>();

/**
 * Wrap an OTEL span to match our interface.
 */
function wrapOtelSpan(otelSpan: OtelSpan): Span {
    return {
        setAttribute(key: string, value: string | number | boolean) {
            otelSpan.setAttribute(key, value);
        },
        setStatus(status: 'ok' | 'error', message?: string) {
            otelSpan.setStatus({
                code: status === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
                message,
            });
        },
        recordException(error: Error) {
            otelSpan.recordException(error);
        },
        end() {
            otelSpan.end();
        },
    };
}

/**
 * Extract or generate trace ID from request
 */
export function getTraceId(request?: NextRequest): string {
    if (request) {
        const headerTraceId = request.headers.get('x-trace-id');
        if (headerTraceId) return headerTraceId;
    }
    return crypto.randomUUID();
}

/**
 * Create trace context headers for propagation
 */
export function createTraceHeaders(traceId: string, parentSpanId?: string): Record<string, string> {
    return {
        'x-trace-id': traceId,
        'x-parent-span-id': parentSpanId || '',
    };
}

/**
 * Start a new span - uses OTEL if available, else in-memory fallback.
 */
export function startSpan(name: string, attributes?: SpanAttributes): Span {
    // Use OTEL if initialized
    if (isOtelInitialized()) {
        try {
            const tracer = getTracer('evermore');
            const otelSpan = tracer.startSpan(name, {
                attributes: attributes as Record<string, string | number | boolean>,
            });
            return wrapOtelSpan(otelSpan);
        } catch {
            // Fall through to in-memory on error
        }
    }

    // Fallback: in-memory span for debugging
    const spanId = crypto.randomUUID();
    const start = Date.now();

    activeSpans.set(spanId, {
        name,
        start,
        attributes: attributes || {},
    });

    return {
        setAttribute(key: string, value: string | number | boolean) {
            const span = activeSpans.get(spanId);
            if (span) {
                span.attributes[key] = value;
            }
        },
        setStatus(status: 'ok' | 'error', message?: string) {
            const span = activeSpans.get(spanId);
            if (span) {
                span.attributes['status'] = status;
                if (message) span.attributes['status.message'] = message;
            }
        },
        recordException(error: Error) {
            const span = activeSpans.get(spanId);
            if (span) {
                span.attributes['error'] = true;
                span.attributes['error.message'] = error.message;
                span.attributes['error.stack'] = error.stack?.substring(0, 500);
            }
        },
        end() {
            const span = activeSpans.get(spanId);
            if (span) {
                const duration = Date.now() - span.start;

                // Log span when OTEL not available
                if (process.env.NODE_ENV !== 'test') {
                    console.log(JSON.stringify({
                        type: 'span',
                        spanId,
                        name: span.name,
                        durationMs: duration,
                        attributes: span.attributes,
                        timestamp: new Date().toISOString(),
                    }));
                }

                activeSpans.delete(spanId);
            }
        },
    };
}

/**
 * Wrap an async function with a span
 */
export async function withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: SpanAttributes
): Promise<T> {
    const span = startSpan(name, attributes);
    try {
        const result = await fn(span);
        span.setStatus('ok');
        return result;
    } catch (error) {
        span.setStatus('error');
        if (error instanceof Error) {
            span.recordException(error);
        }
        throw error;
    } finally {
        span.end();
    }
}

/**
 * Create a traced fetch function
 */
export function tracedFetch(traceId: string) {
    return async (url: string, options?: RequestInit): Promise<Response> => {
        return withSpan(`fetch.${new URL(url, 'http://localhost').pathname}`, async (span) => {
            span.setAttribute('http.url', url);
            span.setAttribute('http.method', options?.method || 'GET');

            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options?.headers,
                    ...createTraceHeaders(traceId),
                },
            });

            span.setAttribute('http.status_code', response.status);
            return response;
        });
    };
}

/**
 * Instrument an API route handler
 */
export function instrumentRoute<T>(
    routeName: string,
    handler: (request: NextRequest, span: Span) => Promise<T>
) {
    return async (request: NextRequest): Promise<T> => {
        const traceId = getTraceId(request);

        return withSpan(`route.${routeName}`, async (span) => {
            span.setAttribute('http.method', request.method);
            span.setAttribute('http.url', request.url);
            span.setAttribute('trace.id', traceId);

            const userId = request.headers.get('x-user-id');
            if (userId) {
                span.setAttribute('user.id', userId);
            }

            return handler(request, span);
        }, { 'trace.id': traceId });
    };
}
