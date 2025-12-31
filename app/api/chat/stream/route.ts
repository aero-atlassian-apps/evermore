/**
 * Streaming Chat API - Server-Sent Events for real-time conversation
 * 
 * Compatible with:
 * - Vercel Serverless Functions (nodejs runtime)
 * - Docker/Node.js runtime
 * 
 * Events streamed:
 * - state: Agent phase transitions (listening, understanding, thinking, responding)
 * - token: Partial response text
 * - done: Final response with metadata
 * - error: Error details
 * 
 * Note: Using nodejs runtime instead of edge because we need database access
 * (Drizzle/PostgreSQL). SSE streaming works with both runtimes.
 */

import { NextRequest } from 'next/server';
import { streamingProcessMessageUseCase } from '@/lib/infrastructure/di/container';
import {
    sanitizeChatRequest,
} from '@/lib/core/application/security/InputSanitization';
import { logger } from '@/lib/core/application/Logger';

// Use nodejs runtime for database compatibility (Vercel free plan supports this)
export const runtime = 'nodejs';
// Increase timeout for streaming (Vercel Pro: 60s, Free: 10s)
export const maxDuration = 30;

export async function POST(req: NextRequest) {
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();

    try {
        const body = await req.json();

        // Validate input
        const validation = sanitizeChatRequest(body);
        if (!validation.valid) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { sessionId, message } = validation.data!;

        logger.info('Starting streaming chat', { traceId, sessionId });

        // Create SSE stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (event: string, data: any) => {
                    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(payload));
                };

                try {
                    // Stream agent events
                    await streamingProcessMessageUseCase.executeStreaming(
                        sessionId,
                        message,
                        'user',
                        {
                            onStateChange: (state: string, details?: string) => {
                                sendEvent('state', { state, details, timestamp: Date.now() });
                            },
                            onToken: (token: string) => {
                                sendEvent('token', { token });
                            },
                            onComplete: (response: any) => {
                                sendEvent('done', response);
                            },
                            onError: (error: string) => {
                                sendEvent('error', { error });
                            }
                        }
                    );

                    controller.close();
                } catch (error: any) {
                    sendEvent('error', { error: error.message });
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        logger.error('Streaming chat error', { traceId, error: error.message });
        return new Response(
            JSON.stringify({ error: 'Failed to start stream' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
