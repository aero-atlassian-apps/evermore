import { NextRequest, NextResponse } from 'next/server';
import { speechProvider } from '@/lib/infrastructure/di/container';
import { logger } from '@/lib/core/application/Logger';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { text, style } = body;

        if (!text) {
            return NextResponse.json({ error: "No text provided" }, { status: 400 });
        }

        const audioBuffer = await speechProvider.textToSpeech(text, style);

        // Convert Buffer to Blob for strict type compatibility with NextResponse BodyInit
        // Explicitly cast to any to bypass the Buffer/ArrayBuffer mismatch in strict mode
        const blob = new Blob([audioBuffer as any], { type: 'audio/mpeg' });

        return new NextResponse(blob, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length.toString(),
            }
        });

    } catch (error: any) {
        logger.error('[TTS] TTS failed', { error: error.message });

        // Return hint for client to use browser Web Speech API
        const isQuotaOrCredential = error.message?.includes('quota') ||
            error.message?.includes('credentials') ||
            error.message?.includes('authentication') ||
            error.message?.includes('GOOGLE') ||
            error.message?.includes('ElevenLabs');

        return NextResponse.json({
            error: error.message,
            useBrowserFallback: isQuotaOrCredential,
            text: isQuotaOrCredential ? null : undefined // Signal client to use browser TTS with original text
        }, { status: 500 });
    }
}
