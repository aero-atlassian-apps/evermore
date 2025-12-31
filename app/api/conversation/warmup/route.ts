import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/core/application/Logger';

/**
 * POST /api/conversation/warmup
 * Get signed WebSocket URL for ElevenLabs Conversational Agent
 * 
 * Vercel-compatible: Simple fetch to ElevenLabs API
 */
export async function POST(req: NextRequest) {
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();

    try {
        const body = await req.json();
        const { userName } = body;

        const agentId = process.env.ELEVENLABS_AGENT_ID;
        const apiKey = process.env.ELEVENLABS_API_KEY;

        if (!agentId || !apiKey) {
            logger.error('ElevenLabs credentials missing', { traceId });
            return NextResponse.json(
                { error: 'Voice service not configured' },
                { status: 500 }
            );
        }

        // Get signed WebSocket URL from ElevenLabs
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
            {
                method: 'GET',
                headers: {
                    'xi-api-key': apiKey,
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('ElevenLabs signed URL request failed', {
                traceId,
                status: response.status,
                error: errorText,
            });
            return NextResponse.json(
                { error: 'Failed to initialize voice conversation' },
                { status: 502 }
            );
        }

        const data = await response.json();

        logger.info('ElevenLabs warm-up conversation initiated', {
            traceId,
            userName,
            agentId,
        });

        return NextResponse.json({
            wsUrl: data.signed_url,
            agentId,
        });

    } catch (error: any) {
        logger.error('Error initiating warm-up conversation', {
            traceId,
            error: error.message,
        });
        return NextResponse.json(
            { error: 'Failed to start conversation' },
            { status: 500 }
        );
    }
}
