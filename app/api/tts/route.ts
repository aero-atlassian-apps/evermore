/**
 * TTS API - Text-to-Speech endpoint
 * 
 * Generates audio from text using ElevenLabs with Google Cloud TTS fallback.
 * Returns audio/mpeg data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { speechProvider, narrationAgent } from '@/lib/infrastructure/di/container';
import { logger } from '@/lib/core/application/Logger';
import { recordHttpRequest } from '@/lib/core/application/observability/Metrics';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
    const reqStart = Date.now();
    let statusCode = 200;
    try {
        const body = await request.json();
        const { text, emotion } = body;
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();

        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            );
        }

        // Limit text length to prevent abuse and quota issues
        const rawText = text.substring(0, 5000);

        logger.info('[TTS API] Preparing text for audio', { traceId });

        // 1. Agentic Preparation (Markdown stripping, Pause insertion, Emotion detection)
        const agentResult = await narrationAgent.prepareNarration(rawText, { emotion });
        const { preparedText, voiceStyle, emotion: detectedEmotion } = agentResult;

        // 2. Select Voice based on emotion (if provider supports it)
        const voiceId = narrationAgent.selectVoice(detectedEmotion, voiceStyle);

        logger.info('[TTS API] Generating audio', { traceId, length: preparedText.length, emotion: detectedEmotion, voiceId });

        // 3. Generate Audio using the speech provider
        // Pass style/voiceId if the SpeechPort supports it (casting to any to pass extra options)
        const audioBuffer = await speechProvider.textToSpeech(preparedText, {
            style: voiceStyle,
            voiceId: voiceId
        } as any);

        logger.info('[TTS API] Generated audio', { traceId, bytes: audioBuffer.length });

        // Return audio as binary response
        return new NextResponse(new Uint8Array(audioBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length.toString(),
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        });

    } catch (error: any) {
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        logger.error('[TTS API] Error', { traceId, error: error.message });
        statusCode = 500;

        // Return a hint so client can use browser Web Speech API as fallback
        const errorMsg = error.message?.toLowerCase() || '';
        const isQuotaOrCredential =
            errorMsg.includes('quota') ||
            errorMsg.includes('credentials') ||
            errorMsg.includes('authentication') ||
            errorMsg.includes('google') ||
            errorMsg.includes('elevenlabs') ||
            errorMsg.includes('invalid_grant') ||
            errorMsg.includes('jwt') ||
            errorMsg.includes('unauthorized') ||
            errorMsg.includes('auth');

        return NextResponse.json(
            {
                error: 'Failed to generate audio',
                useBrowserFallback: isQuotaOrCredential,
                fallbackHint: isQuotaOrCredential
                    ? 'Use browser speech synthesis for playback'
                    : null
            },
            { status: 500 }
        );
    }
    finally {
        try {
            const duration = Date.now() - reqStart;
            recordHttpRequest('POST', '/api/tts', statusCode, duration);
        } catch {
            // no-op
        }
    }
}
