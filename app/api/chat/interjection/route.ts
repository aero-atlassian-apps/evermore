import { NextRequest, NextResponse } from 'next/server';
import { llmProvider, sessionRepository } from '@/lib/infrastructure/di/container';
import { InterjectionAgent } from '@/lib/core/application/agents/InterjectionAgent';
import { logger } from '@/lib/core/application/Logger';
import { recordHttpRequest } from '@/lib/core/application/observability/Metrics';

/**
 * POST /api/chat/interjection
 * 
 * Determines if AI should interject based on conversation context.
 * Used for pause detection and memory-triggered responses.
 * 
 * Request body:
 * - sessionId: string
 * - silenceDuration: number (seconds)
 * - recentTranscript: { speaker: 'user' | 'ai', text: string }[]
 * 
 * Response:
 * - shouldInterject: boolean
 * - message?: string
 * - type?: string
 */
export async function POST(request: NextRequest) {
    const reqStart = Date.now();
    let statusCode = 200;
    try {
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        const body = await request.json();
        const { sessionId, silenceDuration, recentTranscript = [] } = body;

        if (!sessionId) {
            return NextResponse.json(
                { error: 'sessionId is required' },
                { status: 400 }
            );
        }

        // Fetch session for context
        let sessionGoal: string | undefined;
        let userName: string | undefined;
        try {
            const session = await sessionRepository.findById(sessionId);
            if (session?.metadata?.goal) {
                sessionGoal = session.metadata.goal;
            }
            if (session?.metadata?.userName) {
                userName = session.metadata.userName;
            }
        } catch (e) {
            logger.warn('[Interjection API] Failed to fetch session', { traceId, error: (e as any)?.message || String(e) });
        }

        // Convert transcript to expected format
        const formattedTranscript = recentTranscript.map((t: any) => ({
            speaker: t.speaker as 'user' | 'ai',
            text: t.text,
            timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
        }));

        // Use InterjectionAgent to decide
        const interjectionAgent = new InterjectionAgent(llmProvider);
        const decision = await interjectionAgent.shouldInterject({
            recentTranscript: formattedTranscript,
            silenceDuration: silenceDuration || 0,
            sessionGoal,
            userName,
            isSessionStart: false,
        });

        return NextResponse.json({
            shouldInterject: decision.shouldInterject,
            message: decision.message,
            type: decision.type,
            priority: decision.priority,
            reason: decision.reason,
        });

    } catch (error: any) {
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        logger.error('[Interjection API] Error', { traceId, error: error });
        statusCode = 500;
        // GRACEFUL FALLBACK: Return no interjection instead of error
        // Conversation continues seamlessly - user doesn't know AI had an issue
        return NextResponse.json({
            shouldInterject: false,
            // No error exposed to client
        });
    } finally {
        try {
            recordHttpRequest('POST', '/api/chat/interjection', statusCode, Date.now() - reqStart);
        } catch {
            // no-op
        }
    }
}
