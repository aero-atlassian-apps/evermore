import { NextRequest, NextResponse } from 'next/server';
import { processMessageUseCase } from '@/lib/infrastructure/di/container';
import {
    sanitizeChatRequest,
    sanitizeForLogging
} from '@/lib/core/application/security/InputSanitization';
import { logger } from '@/lib/core/application/Logger';

export async function POST(req: NextRequest) {
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();

    try {
        const body = await req.json();

        // SECURITY: Validate and sanitize input
        const validation = sanitizeChatRequest(body);
        if (!validation.valid) {
            logger.warn('Chat request validation failed', {
                traceId,
                error: validation.error
            });
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const { sessionId, message } = validation.data!;

        logger.info('Processing chat message', {
            traceId,
            sessionId,
            messageLength: message.length,
            // SECURITY: Never log raw message content
            messagePreview: sanitizeForLogging(message, 50),
        });

        const response = await processMessageUseCase.execute(sessionId, message, 'user');

        return NextResponse.json(response);
    } catch (error: any) {
        logger.error('Chat API error', {
            traceId,
            error: error.message,
            // SECURITY: Don't expose stack traces in production
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
        });
        return NextResponse.json(
            { error: 'Failed to process message' },
            { status: 500 }
        );
    }
}
