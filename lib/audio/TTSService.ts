/**
 * Text-to-Speech (TTS) Service Interface
 * 
 * Defines the contract for TTS providers (ElevenLabs, Google, Web Speech API)
 * 
 * Note: The main TTS provider chain is configured in the DI container:
 * ElevenLabs → Google Cloud TTS (silent fallback when quota exhausted)
 * 
 * This module provides browser-side TTS for client components.
 */

export interface TTSVoice {
    id: string;
    name: string;
    gender?: 'male' | 'female' | 'neutral';
    language: string;
    previewUrl?: string;
}

export interface TTSOptions {
    voiceId?: string;
    speed?: number; // 0.5 - 2.0
    pitch?: number; // 0.5 - 2.0
    emotion?: 'neutral' | 'warm' | 'excited' | 'calm';
    stability?: number; // 0-1 (ElevenLabs specific)
    clarity?: number; // 0-1 (ElevenLabs specific)
}

export interface TTSResult {
    audioData: ArrayBuffer;
    mimeType: string;
    duration: number; // seconds
    provider: string;
}

export interface TTSService {
    /**
     * Generate audio from text
     */
    synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;

    /**
     * Get available voices
     */
    getVoices(): Promise<TTSVoice[]>;

    /**
     * Check if service is available
     */
    isAvailable(): Promise<boolean>;

    /**
     * Provider name for logging
     */
    readonly providerName: string;
}

/**
 * Server-side TTS Service - fallback for Node.js environments
 * Returns a no-op implementation that gracefully degrades
 */
export class ServerTTSService implements TTSService {
    readonly providerName = 'Server Fallback (No Audio)';

    async isAvailable(): Promise<boolean> {
        return true;
    }

    async getVoices(): Promise<TTSVoice[]> {
        return [{
            id: 'server-default',
            name: 'Text Only (Server)',
            language: 'en-US',
            gender: 'neutral'
        }];
    }

    async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
        const wordCount = text.split(/\s+/).length;
        const wordsPerSecond = (options?.speed || 1) * 2.5;
        const estimatedDuration = wordCount / wordsPerSecond;

        return {
            audioData: new ArrayBuffer(0),
            mimeType: 'audio/wav',
            duration: estimatedDuration,
            provider: this.providerName,
        };
    }
}

/**
 * TTS Service Factory - Returns best available browser-side provider
 * 
 * For server-side TTS, use the speechProvider from the DI container which
 * provides ElevenLabs → Google Cloud TTS fallback chain.
 * 
 * This factory is for client-side usage only.
 */
export function createTTSService(): TTSService {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const { WebSpeechTTS } = require('./WebSpeechTTS');
        return new WebSpeechTTS();
    }

    // Server-side - use fallback (actual TTS handled by DI speechProvider)
    return new ServerTTSService();
}

/**
 * Async factory that checks availability before returning
 */
export async function createTTSServiceAsync(): Promise<TTSService> {
    const service = createTTSService();
    const available = await service.isAvailable();

    if (!available) {
        return new ServerTTSService();
    }

    return service;
}
