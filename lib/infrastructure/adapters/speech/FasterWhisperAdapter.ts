/**
 * Faster-Whisper Adapter - Local Speech-to-Text
 * 
 * Uses Faster-Whisper via Docker for local STT.
 * Zero cost, full privacy, runs on CPU.
 * 
 * @module FasterWhisperAdapter
 */

import { logger } from '@/lib/core/application/Logger';

// ============================================================================
// Types
// ============================================================================

export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
}

export interface TranscriptionOptions {
    language?: string;
    task?: 'transcribe' | 'translate';
}

// ============================================================================
// Faster-Whisper Adapter
// ============================================================================

export class FasterWhisperAdapter {
    private baseUrl: string;

    constructor(
        baseUrl: string = process.env.WHISPER_URL || 'http://localhost:9000'
    ) {
        this.baseUrl = baseUrl;
    }

    /**
     * Transcribe audio to text.
     */
    async transcribe(
        audio: Buffer | ArrayBuffer,
        options: TranscriptionOptions = {}
    ): Promise<TranscriptionResult> {
        logger.debug('[FasterWhisperAdapter] Transcribing audio', {
            audioSize: audio instanceof Buffer ? audio.length : audio.byteLength,
            language: options.language,
        });

        try {
            const formData = new FormData();

            // Convert to Blob for FormData
            const audioArray = audio instanceof Buffer
                ? new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength)
                : new Uint8Array(audio);
            const audioBlob = new Blob([audioArray as unknown as BlobPart], { type: 'audio/wav' });
            formData.append('audio_file', audioBlob, 'audio.wav');

            if (options.language) {
                formData.append('language', options.language);
            }
            if (options.task) {
                formData.append('task', options.task);
            }

            const response = await fetch(`${this.baseUrl}/asr`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Whisper API error: ${response.status}`);
            }

            const data = await response.json();

            logger.debug('[FasterWhisperAdapter] Transcription complete', {
                textLength: data.text?.length,
            });

            return {
                text: data.text || '',
                language: data.language,
                duration: data.duration,
                segments: data.segments,
            };
        } catch (error) {
            logger.error('[FasterWhisperAdapter] Transcription failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Transcribe audio file from URL.
     */
    async transcribeUrl(
        audioUrl: string,
        options: TranscriptionOptions = {}
    ): Promise<TranscriptionResult> {
        logger.debug('[FasterWhisperAdapter] Fetching audio from URL', { audioUrl });

        const response = await fetch(audioUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        return this.transcribe(buffer, options);
    }

    /**
     * Check if Whisper service is available.
     */
    async isAvailable(): Promise<boolean> {
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

    /**
     * Get supported languages.
     */
    getSupportedLanguages(): string[] {
        // Whisper supports 99 languages
        return [
            'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja',
            'ko', 'zh', 'ar', 'hi', 'tr', 'vi', 'th', 'id', 'ms', 'sv',
            // ... and many more
        ];
    }
}

// ============================================================================
// Factory
// ============================================================================

let instance: FasterWhisperAdapter | null = null;

export function getFasterWhisperAdapter(): FasterWhisperAdapter {
    if (!instance) {
        instance = new FasterWhisperAdapter();
    }
    return instance;
}

export function isLocalSTTEnabled(): boolean {
    return process.env.STT_PROVIDER === 'local' || process.env.STT_PROVIDER === 'whisper';
}
