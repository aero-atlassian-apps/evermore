/**
 * Kokoro TTS Adapter - Local Text-to-Speech
 * 
 * Uses Kokoro-FastAPI for local TTS synthesis.
 * ElevenLabs-compatible API, zero cost, full privacy.
 * 
 * @module KokoroTTSAdapter
 */

import { logger } from '@/lib/core/application/Logger';

// ============================================================================
// Types
// ============================================================================

export interface TTSOptions {
    voice?: string;
    speed?: number;
    pitch?: number;
    format?: 'mp3' | 'wav' | 'ogg';
}

export interface TTSResult {
    audio: Buffer;
    format: string;
    duration?: number;
}

// ============================================================================
// Kokoro TTS Adapter
// ============================================================================

export class KokoroTTSAdapter {
    private baseUrl: string;
    private defaultVoice: string;

    constructor(
        baseUrl: string = process.env.KOKORO_URL || 'http://localhost:8880',
        defaultVoice: string = 'af_bella'
    ) {
        this.baseUrl = baseUrl;
        this.defaultVoice = defaultVoice;
    }

    /**
     * Synthesize text to speech.
     */
    async synthesize(
        text: string,
        options: TTSOptions = {}
    ): Promise<TTSResult> {
        logger.debug('[KokoroTTSAdapter] Synthesizing speech', {
            textLength: text.length,
            voice: options.voice || this.defaultVoice,
        });

        try {
            const voice = options.voice || this.defaultVoice;
            const format = options.format || 'mp3';

            // Kokoro-FastAPI uses OpenAI-compatible endpoint
            const response = await fetch(`${this.baseUrl}/v1/audio/speech`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'kokoro',
                    input: text,
                    voice: voice,
                    speed: options.speed ?? 1.0,
                    response_format: format,
                }),
            });

            if (!response.ok) {
                // Try fallback endpoint
                return this.synthesizeFallback(text, options);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audio = Buffer.from(arrayBuffer);

            logger.debug('[KokoroTTSAdapter] Synthesis complete', {
                audioSize: audio.length,
            });

            return {
                audio,
                format,
            };
        } catch (error) {
            logger.error('[KokoroTTSAdapter] Synthesis failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Fallback synthesis using direct endpoint.
     */
    private async synthesizeFallback(
        text: string,
        options: TTSOptions = {}
    ): Promise<TTSResult> {
        const voice = options.voice || this.defaultVoice;
        const format = options.format || 'wav';

        const response = await fetch(`${this.baseUrl}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                voice,
                speed: options.speed ?? 1.0,
            }),
        });

        if (!response.ok) {
            throw new Error(`Kokoro TTS error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return {
            audio: Buffer.from(arrayBuffer),
            format,
        };
    }

    /**
     * Get available voices.
     */
    async getVoices(): Promise<Array<{ id: string; name: string }>> {
        try {
            const response = await fetch(`${this.baseUrl}/v1/voices`);
            if (!response.ok) {
                // Return default voices if endpoint not available
                return this.getDefaultVoices();
            }

            const data = await response.json();
            return data.voices || this.getDefaultVoices();
        } catch {
            return this.getDefaultVoices();
        }
    }

    /**
     * Default Kokoro voices.
     */
    private getDefaultVoices(): Array<{ id: string; name: string }> {
        return [
            { id: 'af_bella', name: 'Bella (American Female)' },
            { id: 'af_nicole', name: 'Nicole (American Female)' },
            { id: 'af_sarah', name: 'Sarah (American Female)' },
            { id: 'am_adam', name: 'Adam (American Male)' },
            { id: 'am_michael', name: 'Michael (American Male)' },
            { id: 'bf_emma', name: 'Emma (British Female)' },
            { id: 'bf_isabella', name: 'Isabella (British Female)' },
            { id: 'bm_george', name: 'George (British Male)' },
            { id: 'bm_lewis', name: 'Lewis (British Male)' },
        ];
    }

    /**
     * Check if Kokoro service is available.
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            // Try alternate health endpoint
            try {
                const response = await fetch(`${this.baseUrl}/`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000),
                });
                return response.ok;
            } catch {
                return false;
            }
        }
    }
}

// ============================================================================
// Factory
// ============================================================================

let instance: KokoroTTSAdapter | null = null;

export function getKokoroTTSAdapter(): KokoroTTSAdapter {
    if (!instance) {
        instance = new KokoroTTSAdapter();
    }
    return instance;
}

export function isLocalTTSEnabled(): boolean {
    return process.env.TTS_PROVIDER === 'local' || process.env.TTS_PROVIDER === 'kokoro';
}
