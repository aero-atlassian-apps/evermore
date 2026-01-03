import { NextResponse } from 'next/server';
import { metrics } from '@/lib/core/application/observability/Metrics';
import { withPermission } from '@/lib/auth/rbac-middleware';
import { Permission } from '@/lib/auth/roles';

/**
 * GET /api/metrics
 * 
 * Exposes application metrics in Prometheus format.
 * Protected by RBAC to prevent leaking system internals.
 */
export const GET = withPermission(Permission.VIEW_SYSTEM_METRICS, async () => {
    try {
        // Note: The PrometheusExporter usually serves metrics on its own port (9464),
        // but this endpoint provides a secured way to access them from the main API.
        const prometheusData = await metrics.toPrometheusFormat();

        return new NextResponse(prometheusData, {
            headers: {
                'Content-Type': 'text/plain; version=0.0.4',
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 });
    }
});
