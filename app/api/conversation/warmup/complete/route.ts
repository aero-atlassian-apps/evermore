import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/core/application/Logger';
import { sessionRepository, llmGateway } from '@/lib/infrastructure/di/container';
import { RequestTier } from '@/lib/infrastructure/adapters/ai/ThroughputConfig';
import type { TranscriptEntry } from '@/lib/types/elevenlabs-websocket';

/**
 * POST /api/conversation/warmup/complete
 * Save warm-up phase data and extract topic using LLM
 * 
 * Vercel-compatible: Standard serverless function
 */
export async function POST(req: NextRequest) {
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();

    try {
        const body = await req.json();
        const { sessionId, transcript, durationSeconds, conversationId } = body as {
            sessionId: string;
            transcript: TranscriptEntry[];
            durationSeconds: number;
            conversationId: string;
        };

        if (!sessionId || !transcript) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Extract topic from transcript using LLM
        let extractedTopic: string | null = null;

        if (transcript.length > 0) {
            try {
                const conversationText = transcript
                    .map(t => `${t.speaker === 'agent' ? 'Evermore' : 'User'}: ${t.text}`)
                    .join('\n');

                const prompt = `Analyze this warm-up conversation between a user and an AI assistant named Evermore. The user is about to tell a personal story or memory.

Extract the MAIN TOPIC or MEMORY the user wants to share. Be specific but concise (max 10 words).

If no clear topic was mentioned, respond with "General life story".

Conversation:
${conversationText}

Extracted topic:`;

                const result = await llmGateway.generateText(
                    prompt,
                    RequestTier.INTERACTIVE,
                    { purpose: 'topic_extraction', sessionId },
                    { maxTokens: 50, temperature: 0.3 }
                );

                extractedTopic = result?.trim() || null;

                logger.info('Topic extracted from warm-up', {
                    traceId,
                    sessionId,
                    extractedTopic,
                });
            } catch (err: any) {
                logger.warn('Topic extraction failed, continuing without topic', {
                    traceId,
                    sessionId,
                    error: err.message,
                });
                extractedTopic = null;
            }
        }

        // Update session with warm-up data
        const session = await sessionRepository.findById(sessionId);

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        // Extend metadata with warm-up data
        session.metadata = {
            ...session.metadata,
            warmup_data: {
                transcript,
                extractedTopic,
                duration_seconds: durationSeconds,
                elevenlabs_conversation_id: conversationId,
                completed_at: new Date().toISOString(),
            },
        };

        await sessionRepository.update(session);

        logger.info('Warm-up phase completed', {
            traceId,
            sessionId,
            transcriptLength: transcript.length,
            durationSeconds,
            extractedTopic,
        });

        return NextResponse.json({
            success: true,
            extractedTopic,
        });

    } catch (error: any) {
        logger.error('Error completing warm-up phase', {
            traceId,
            error: error.message,
        });
        return NextResponse.json(
            { error: 'Failed to save warm-up data' },
            { status: 500 }
        );
    }
}
