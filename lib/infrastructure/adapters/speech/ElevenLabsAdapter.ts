import { SpeechPort, SpeechToTextResult, SpeechOptions } from '../../../core/application/ports/SpeechPort';
import { VoiceAgentPort } from '../../../core/application/ports/VoiceAgentPort';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Readable } from 'stream';

/**
 * ElevenLabs Adapter - Production speech synthesis and recognition.
 * 
 * SILENT FALLBACK: Provider switches are completely invisible to users.
 * When ElevenLabs quota is exhausted or fails, falls back to Google TTS silently.
 * 
 * Configuration:
 * - ELEVENLABS_API_KEY: Required for TTS
 * - ELEVENLABS_VOICE_ID: Voice ID for TTS
 * - ELEVENLABS_AGENT_ID: Agent ID for conversations
 * 
 * Fallback Chain: ElevenLabs → Google Cloud TTS (silent)
 * 
 * @module ElevenLabsAdapter
 */
export class ElevenLabsAdapter implements SpeechPort, VoiceAgentPort {
    private client: ElevenLabsClient;
    private sttFallback: SpeechPort | null = null;
    private ttsFallback: SpeechPort | null = null;

    // Cache quota state to avoid repeated failures (reset on process restart)
    private static quotaExhausted = false;

    constructor(sttFallback?: SpeechPort, ttsFallback?: SpeechPort) {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        // Silent initialization - no user-facing warnings

        this.client = new ElevenLabsClient({ apiKey: apiKey || 'dummy-key-for-build' });

        if (sttFallback) this.sttFallback = sttFallback;
        if (ttsFallback) this.ttsFallback = ttsFallback;
    }

    async textToSpeech(text: string, options?: SpeechOptions): Promise<Buffer> {
        // Skip ElevenLabs entirely if quota already known to be exhausted
        if (ElevenLabsAdapter.quotaExhausted && this.ttsFallback) {
            return await this.ttsFallback.textToSpeech(text, options);
        }

        try {
            const style = options?.style;
            const stability = style === 'emotional' ? 0.35 : 0.7;
            const response = await this.client.textToSpeech.convert(
                process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
                {
                    text,
                    model_id: 'eleven_turbo_v2_5',
                    voice_settings: { stability, similarity_boost: 0.75 }
                } as any
            );
            const chunks: Buffer[] = [];
            for await (const chunk of (response as any)) {
                chunks.push(Buffer.from(chunk));
            }
            return Buffer.concat(chunks);
        } catch (error: any) {
            // SILENT FALLBACK: Check for quota exceeded - switch silently to fallback
            const isQuotaError = error?.body?.detail?.status === 'quota_exceeded' ||
                error?.statusCode === 401 ||
                error?.message?.toLowerCase().includes('quota');

            if (isQuotaError) {
                // Silent switch - user doesn't need to know
                ElevenLabsAdapter.quotaExhausted = true;
            }
            // No console.error - keep failures silent to users

            // Fallback to secondary provider if configured (e.g. Google Cloud TTS)
            if (this.ttsFallback) {
                // Silent fallback - no user-facing error
                return await this.ttsFallback.textToSpeech(text, options);
            }

            throw error;
        }
    }

    async speechToText(audioBuffer: Buffer, contentType: string): Promise<SpeechToTextResult> {
        // Use injected fallback STT provider (Google Cloud Speech)
        if (this.sttFallback) {
            // Silent fallback - no user-facing error
            return await this.sttFallback.speechToText(audioBuffer, contentType);
        }

        throw new Error('Speech to text failed: No working provider available');
    }

    private async bufferToFile(buffer: Buffer, filename: string, _contentType: string): Promise<any> {
        return Object.assign(Readable.from(buffer), {
            path: filename,
            name: filename,
            lastModified: Date.now()
        });
    }

    async startConversation(
        userId: string,
        sessionId: string,
        userName: string,
        context: { goal: string; memories: any[]; imageContext?: string }
    ): Promise<{ agentId: string; conversationId: string; wsUrl?: string }> {
        const agentId = process.env.ELEVENLABS_AGENT_ID;
        const apiKey = process.env.ELEVENLABS_API_KEY;

        if (!agentId || !apiKey) {
            throw new Error('ElevenLabsAdapter: ELEVENLABS_AGENT_ID and API_KEY are required');
        }

        try {
            // REST API for conversation initiation
            const response = await fetch(
                `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
                {
                    method: 'GET',
                    headers: {
                        'xi-api-key': apiKey,
                    }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get signed URL: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            return {
                agentId: agentId,
                conversationId: data.conversation_id || 'new-session',
                wsUrl: data.signed_url
            };
        } catch (error) {
            // Keep error logging for critical conversation failures
            console.error('ElevenLabs startConversation failed', error);
            throw error;
        }
    }
}
