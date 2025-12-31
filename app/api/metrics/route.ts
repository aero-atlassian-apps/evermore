import { NextResponse } from 'next/server';
import { metrics } from '@/lib/core/application/observability/Metrics';
import { llmUsageTracker } from '@/lib/core/application/services/LLMUsageTracker';
import { rateLimiter } from '@/lib/core/application/security/RateLimiter';
import { idempotencyStore } from '@/lib/core/application/security/Idempotency';

/**
 * Metrics endpoint for monitoring systems.
 * 
 * Use Accept header to control format:
 * - Accept: text/plain → Prometheus format
 * - Accept: application/json → JSON format (default)
 */
export async function GET(request: Request) {
    // Check for metrics auth token in production
    const authToken = request.headers.get('x-metrics-token');
    if (process.env.NODE_ENV === 'production' && process.env.METRICS_TOKEN) {
        if (authToken !== process.env.METRICS_TOKEN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const accept = request.headers.get('accept') || 'application/json';

    // Prometheus format
    if (accept.includes('text/plain')) {
        const prometheus = metrics.toPrometheusFormat();
        return new NextResponse(prometheus, {
            headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
        });
    }

    // JSON format with additional stats
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const llmStats = llmUsageTracker.getSummary(last24Hours);
    const rateLimiterStats = rateLimiter.getStats();
    const idempotencyStats = idempotencyStore.getStats();

    return NextResponse.json({
        timestamp: new Date().toISOString(),

        // LLM Usage (last 24h)
        llm: {
            totalRequests: llmStats.totalRecords,
            totalTokens: llmStats.totalTokens,
            totalCostCents: llmStats.totalCostCents.toFixed(4),
            averageTokensPerRequest: Math.round(llmStats.averageTokensPerRequest),
            byModel: llmStats.byModel,
            byPurpose: llmStats.byPurpose,
        },

        // Rate Limiter
        rateLimiter: rateLimiterStats,

        // Idempotency Store
        idempotency: idempotencyStats,

        // Histograms
        histograms: {
            httpRequestDuration: metrics.getHistogram('http.server.request.duration'),
            llmRequestDuration: metrics.getHistogram('llm.request.duration'),
            agentExecutionDuration: metrics.getHistogram('agent.execution.duration'),
        },

        // Counters
        counters: {
            httpRequests: metrics.getCounter('http.server.request.count'),
            llmErrors: metrics.getCounter('llm.request.errors'),
            safetyAlerts: metrics.getCounter('safety.alerts.total'),
            rateLimitExceeded: metrics.getCounter('ratelimit.exceeded.total'),
        },
    });
}
