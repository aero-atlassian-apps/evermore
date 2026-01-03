import { NextRequest, NextResponse } from 'next/server';
import { audioEmotionAnalyzer } from '@/lib/infrastructure/adapters/audio/AudioEmotionAnalyzer';
import { empathyEngine } from '@/lib/core/application/agent/persona/EmpathyEngine';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/core/application/security/RateLimiter';
import { logger } from '@/lib/core/application/Logger';
import { withSpan } from '@/lib/core/observability/tracing';
import type { AudioData } from '@/lib/core/application/ports/AudioEmotionPort';

/**
 * POST /api/emotion/analyze
 * 
 * Analyze audio and/or text for emotional content.
 * 
 * Request body:
 * - audioBase64?: string - Base64-encoded audio data
 * - audioFormat?: 'pcm' | 'wav' | 'webm' - Audio format (default: pcm)
 * - sampleRate?: number - Sample rate in Hz (default: 16000)
 * - text?: string - Text to analyze alongside audio
 * 
 * Response:
 * - emotionalState: EmotionalState object with detected emotion
 * - audioResult?: AudioEmotionResult if audio was provided
 */
async function handleAnalyze(request: NextRequest): Promise<NextResponse> {
    return withSpan('emotion.analyze', async (span) => {
        try {
            const body = await request.json();
            const { audioBase64, audioFormat = 'pcm', sampleRate = 16000, text } = body;

            span.setAttribute('hasAudio', !!audioBase64);
            span.setAttribute('hasText', !!text);

            if (!audioBase64 && !text) {
                return NextResponse.json(
                    { error: 'Either audioBase64 or text must be provided' },
                    { status: 400 }
                );
            }

            let audioResult = undefined;
            let prosody = undefined;

            // Analyze audio if provided
            if (audioBase64) {
                logger.debug('[EmotionAPI] Analyzing audio', {
                    format: audioFormat,
                    sampleRate
                });

                // Decode base64 audio
                const audioBuffer = Buffer.from(audioBase64, 'base64');
                const audioData: AudioData = {
                    buffer: audioBuffer.buffer.slice(
                        audioBuffer.byteOffset,
                        audioBuffer.byteOffset + audioBuffer.byteLength
                    ),
                    sampleRate,
                    channels: 1,
                    duration: audioBuffer.length / (sampleRate * 2), // 16-bit = 2 bytes/sample
                    format: audioFormat,
                };

                // Get audio emotion analysis
                audioResult = await audioEmotionAnalyzer.analyzeAudio(audioData);
                prosody = await audioEmotionAnalyzer.extractProsody(audioData);

                span.setAttribute('audioEmotion', audioResult.emotion);
                span.setAttribute('audioConfidence', audioResult.confidence);
            }

            // Combine with text analysis if text is provided
            let emotionalState;
            if (text) {
                // Use EmpathyEngine for combined analysis
                emotionalState = empathyEngine.detectEmotion(text, prosody);
                span.setAttribute('textEmotion', emotionalState.primaryEmotion);
            } else if (audioResult) {
                // Audio-only: map audio result to emotional state format
                emotionalState = {
                    primaryEmotion: audioResult.emotion,
                    intensity: Math.ceil(audioResult.confidence * 5) as 1 | 2 | 3 | 4 | 5,
                    confidence: audioResult.confidence,
                    valence: audioResult.valence,
                    arousal: audioResult.arousal,
                    triggers: [],
                    needsSupport: audioResult.valence < -0.5,
                    recommendEscalation: audioResult.valence < -0.8 || audioResult.paralinguistics.hasCrying,
                    analysisDetails: {
                        textSignals: [],
                        voiceSignals: audioResult.paralinguistics.hasLaughter ?
                            [{ type: 'paralinguistic' as const, emotion: audioResult.emotion, strength: 0.8, description: 'Laughter detected' }] :
                            [],
                        combinedScore: audioResult.confidence,
                        timestamp: audioResult.timestamp,
                    },
                };
            }

            logger.info('[EmotionAPI] Analysis complete', {
                emotion: emotionalState?.primaryEmotion,
                hasAudio: !!audioResult,
                hasText: !!text,
            });

            return NextResponse.json({
                emotionalState,
                audioResult: audioResult ? {
                    emotion: audioResult.emotion,
                    confidence: audioResult.confidence,
                    valence: audioResult.valence,
                    arousal: audioResult.arousal,
                    dominance: audioResult.dominance,
                    paralinguistics: audioResult.paralinguistics,
                } : undefined,
            });
        } catch (error) {
            logger.error('[EmotionAPI] Analysis failed', {
                error: error instanceof Error ? error.message : String(error)
            });

            span.setStatus('error', error instanceof Error ? error.message : 'Unknown error');

            return NextResponse.json(
                { error: 'Emotion analysis failed' },
                { status: 500 }
            );
        }
    });
}

// Export with rate limiting applied
export const POST = withRateLimit(handleAnalyze, RATE_LIMIT_PRESETS.llmIntensive);
