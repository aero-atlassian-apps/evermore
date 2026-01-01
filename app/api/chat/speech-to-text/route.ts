import { NextRequest, NextResponse } from 'next/server';
import { speechProvider } from '@/lib/infrastructure/di/container';
import { getAudioConverter } from '@/lib/infrastructure/services/AudioConverter';
import { logger } from '@/lib/core/application/Logger';
import { recordHttpRequest } from '@/lib/core/application/observability/Metrics';

export async function POST(request: NextRequest) {
    const reqStart = Date.now();
    let statusCode = 200;
    try {
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        let buffer = Buffer.from(arrayBuffer);
        let contentType = file.type || 'audio/wav';

        // Convert WebM/Opus to WAV for universal STT compatibility
        // Most STT APIs work best with WAV format at 16kHz mono
        if (contentType.includes('webm') || contentType.includes('opus')) {
            try {
                const audioConverter = getAudioConverter();
                const isAvailable = await audioConverter.isAvailable();

                if (isAvailable) {
                    const converted = await audioConverter.convert(buffer, contentType, {
                        targetFormat: 'wav',
                        sampleRate: 16000,
                        channels: 1
                    });
                    // Copy to a new Buffer to avoid type issues with ArrayBufferLike
                    const convertedData = new Uint8Array(converted.buffer);
                    buffer = Buffer.from(convertedData);
                    contentType = converted.format;
                    logger.info('[STT] Audio converted to WAV for STT compatibility', { traceId });
                } else {
                    logger.warn('[STT] FFmpeg not available, sending original format', { traceId });
                }
            } catch (conversionError: any) {
                logger.warn('[STT] Audio conversion failed, trying original format', { traceId, error: conversionError.message });
                // Continue with original format - some APIs might still accept it
            }
        }

        const result = await speechProvider.speechToText(buffer, contentType);
        logger.info('[STT] STT succeeded', { traceId, length: buffer.length, mime: contentType });
        // Return only the text string, not the full SpeechToTextResult object
        // This prevents "Objects are not valid as React child" errors
        return NextResponse.json({ text: result.text });

    } catch (error: any) {
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        logger.error('[STT] STT failed', { traceId, error: error.message });
        statusCode = 500;

        // Return a special response that tells the client to use browser STT fallback
        // This enables graceful degradation when Google Cloud credentials aren't working
        const isCredentialError = error.message?.includes('credentials') ||
            error.message?.includes('authentication') ||
            error.message?.includes('GOOGLE');

        return NextResponse.json({
            error: error.message,
            useBrowserFallback: isCredentialError,
            fallbackHint: isCredentialError
                ? 'Server STT unavailable. Please use browser speech recognition.'
                : null
        }, { status: 500 });
    } finally {
        try {
            recordHttpRequest('POST', '/api/chat/speech-to-text', statusCode, Date.now() - reqStart);
        } catch {
            // no-op
        }
    }
}

