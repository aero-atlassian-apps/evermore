import { NextRequest } from 'next/server';

/**
 * GET /api/admin/stream
 * 
 * Server-Sent Events endpoint for real-time dashboard updates.
 * Sends metrics updates every 5 seconds.
 */
export async function GET(request: NextRequest) {
    // Production authentication check
    if (process.env.NODE_ENV === 'production') {
        const adminToken = request.headers.get('x-admin-token');
        if (adminToken !== process.env.ADMIN_TOKEN) {
            return new Response('Unauthorized', { status: 401 });
        }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Send initial connection event
            controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`));

            // Periodic updates
            const intervalId = setInterval(async () => {
                try {
                    // Fetch current dashboard data
                    const response = await fetch(new URL('/api/admin/dashboard', request.url), {
                        headers: {
                            'x-admin-token': process.env.ADMIN_TOKEN || '',
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        controller.enqueue(
                            encoder.encode(`event: metrics\ndata: ${JSON.stringify(data)}\n\n`)
                        );
                    }
                } catch (error) {
                    console.error('[SSE] Error fetching metrics:', error);
                }
            }, 5000);

            // Clean up on close
            request.signal.addEventListener('abort', () => {
                clearInterval(intervalId);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
