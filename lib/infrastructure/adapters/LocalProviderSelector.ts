/**
 * Local Provider Selector
 * 
 * Provides unified interface for selecting between cloud and local AI providers.
 * Routes to appropriate adapter based on environment configuration.
 * 
 * @module LocalProviderSelector
 */

import { logger } from '@/lib/core/application/Logger';

// ============================================================================
// Types
// ============================================================================

export type ProviderType = 'llm' | 'tts' | 'stt' | 'image';
export type ProviderMode = 'cloud' | 'local' | 'auto';

interface ProviderConfig {
    llm: ProviderMode;
    tts: ProviderMode;
    stt: ProviderMode;
    image: ProviderMode;
}

interface ProviderStatus {
    llm: { mode: ProviderMode; available: boolean; provider: string };
    tts: { mode: ProviderMode; available: boolean; provider: string };
    stt: { mode: ProviderMode; available: boolean; provider: string };
    image: { mode: ProviderMode; available: boolean; provider: string };
}

// ============================================================================
// Configuration
// ============================================================================

function getProviderConfig(): ProviderConfig {
    return {
        llm: (process.env.LLM_PROVIDER as ProviderMode) || 'auto',
        tts: (process.env.TTS_PROVIDER as ProviderMode) || 'auto',
        stt: (process.env.STT_PROVIDER as ProviderMode) || 'auto',
        image: (process.env.IMAGE_PROVIDER as ProviderMode) || 'auto',
    };
}

// ============================================================================
// Provider Selector
// ============================================================================

export class LocalProviderSelector {
    private static instance: LocalProviderSelector;

    private constructor() { }

    static getInstance(): LocalProviderSelector {
        if (!LocalProviderSelector.instance) {
            LocalProviderSelector.instance = new LocalProviderSelector();
        }
        return LocalProviderSelector.instance;
    }

    /**
     * Check if local LLM should be used.
     */
    shouldUseLocalLLM(): boolean {
        const mode = getProviderConfig().llm;

        if (mode === 'local') return true;
        if (mode === 'cloud') return false;

        // Auto: prefer local if available and no cloud key
        return !process.env.GOOGLE_AI_API_KEY && !process.env.OPENAI_API_KEY;
    }

    /**
     * Check if local TTS should be used.
     */
    shouldUseLocalTTS(): boolean {
        const mode = getProviderConfig().tts;

        if (mode === 'local') return true;
        if (mode === 'cloud') return false;

        // Auto: prefer local if no ElevenLabs key
        return !process.env.ELEVENLABS_API_KEY;
    }

    /**
     * Check if local STT should be used.
     */
    shouldUseLocalSTT(): boolean {
        const mode = getProviderConfig().stt;

        if (mode === 'local') return true;
        if (mode === 'cloud') return false;

        // Auto: prefer local if no cloud speech key
        return !process.env.GOOGLE_SPEECH_API_KEY && !process.env.OPENAI_API_KEY;
    }

    /**
     * Check if local image generation should be used.
     */
    shouldUseLocalImage(): boolean {
        const mode = getProviderConfig().image;

        if (mode === 'local') return true;
        if (mode === 'cloud') return false;

        // Auto: prefer local if no cloud image key
        return !process.env.GOOGLE_AI_API_KEY;
    }

    /**
     * Get provider status for all services.
     */
    async getStatus(): Promise<ProviderStatus> {
        const config = getProviderConfig();

        return {
            llm: {
                mode: config.llm,
                available: await this.checkLLMAvailable(),
                provider: this.shouldUseLocalLLM() ? 'ollama' : 'gemini',
            },
            tts: {
                mode: config.tts,
                available: await this.checkTTSAvailable(),
                provider: this.shouldUseLocalTTS() ? 'kokoro' : 'elevenlabs',
            },
            stt: {
                mode: config.stt,
                available: await this.checkSTTAvailable(),
                provider: this.shouldUseLocalSTT() ? 'whisper' : 'vertex',
            },
            image: {
                mode: config.image,
                available: await this.checkImageAvailable(),
                provider: this.shouldUseLocalImage() ? 'localai' : 'imagen',
            },
        };
    }

    /**
     * Check LLM availability.
     */
    private async checkLLMAvailable(): Promise<boolean> {
        if (this.shouldUseLocalLLM()) {
            try {
                const url = process.env.OLLAMA_URL || 'http://localhost:11434';
                const response = await fetch(`${url}/api/tags`, {
                    signal: AbortSignal.timeout(3000)
                });
                return response.ok;
            } catch {
                return false;
            }
        }
        return !!process.env.GOOGLE_AI_API_KEY || !!process.env.OPENAI_API_KEY;
    }

    /**
     * Check TTS availability.
     */
    private async checkTTSAvailable(): Promise<boolean> {
        if (this.shouldUseLocalTTS()) {
            try {
                const url = process.env.KOKORO_URL || 'http://localhost:8880';
                const response = await fetch(`${url}/health`, {
                    signal: AbortSignal.timeout(3000)
                });
                return response.ok;
            } catch {
                return false;
            }
        }
        return !!process.env.ELEVENLABS_API_KEY;
    }

    /**
     * Check STT availability.
     */
    private async checkSTTAvailable(): Promise<boolean> {
        if (this.shouldUseLocalSTT()) {
            try {
                const url = process.env.WHISPER_URL || 'http://localhost:9000';
                const response = await fetch(`${url}/`, {
                    signal: AbortSignal.timeout(3000)
                });
                return response.ok;
            } catch {
                return false;
            }
        }
        return !!process.env.GOOGLE_SPEECH_API_KEY;
    }

    /**
     * Check image generation availability.
     */
    private async checkImageAvailable(): Promise<boolean> {
        if (this.shouldUseLocalImage()) {
            try {
                const url = process.env.LOCALAI_URL || 'http://localhost:8080';
                const response = await fetch(`${url}/v1/models`, {
                    signal: AbortSignal.timeout(3000)
                });
                return response.ok;
            } catch {
                return false;
            }
        }
        return !!process.env.GOOGLE_AI_API_KEY;
    }

    /**
     * Log current provider configuration.
     */
    logConfiguration(): void {
        const config = getProviderConfig();
        logger.info('[LocalProviderSelector] Provider configuration', {
            llm: { mode: config.llm, using: this.shouldUseLocalLLM() ? 'ollama' : 'cloud' },
            tts: { mode: config.tts, using: this.shouldUseLocalTTS() ? 'kokoro' : 'cloud' },
            stt: { mode: config.stt, using: this.shouldUseLocalSTT() ? 'whisper' : 'cloud' },
            image: { mode: config.image, using: this.shouldUseLocalImage() ? 'localai' : 'cloud' },
        });
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const providerSelector = LocalProviderSelector.getInstance();

// ============================================================================
// Helper Functions
// ============================================================================

export function isLocalMode(): boolean {
    const selector = LocalProviderSelector.getInstance();
    return selector.shouldUseLocalLLM() || selector.shouldUseLocalTTS() ||
        selector.shouldUseLocalSTT() || selector.shouldUseLocalImage();
}

export function isFullyLocal(): boolean {
    const selector = LocalProviderSelector.getInstance();
    return selector.shouldUseLocalLLM() && selector.shouldUseLocalTTS() &&
        selector.shouldUseLocalSTT() && selector.shouldUseLocalImage();
}
