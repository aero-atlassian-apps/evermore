/**
 * Speech Context Service - Handles speech-to-text with silence timeout
 * and explicit context passing for the reasoning pipeline.
 * 
 * Critical for voice-to-voice experience integrity:
 * - Graceful silence timeout handling
 * - Explicit context object for STT → reasoning pipeline
 * - User feedback during long pauses
 * 
 * @module SpeechContextService
 */

import { SpeechPort, SpeechToTextResult, SpeechOptions } from '../ports/SpeechPort';
import { normalizeSpeech } from './SpeechNormalizer';
import { logger } from '../../../infrastructure/logging/LoggerService';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for speech context handling
 */
export interface SpeechContextConfig {
    /** Maximum silence duration in milliseconds before timeout */
    silenceTimeoutMs: number;
    /** Minimum audio duration to consider valid input */
    minAudioDurationMs: number;
    /** User-friendly message when silence timeout occurs */
    silenceTimeoutMessage: string;
    /** Message when audio is too short */
    tooShortMessage: string;
    /** Enable speech normalization */
    enableNormalization: boolean;
}

const DEFAULT_CONFIG: SpeechContextConfig = {
    silenceTimeoutMs: 10000, // 10 seconds
    minAudioDurationMs: 500, // 0.5 seconds
    silenceTimeoutMessage: "I didn't hear anything. Take your time - I'm here when you're ready to continue.",
    tooShortMessage: "I couldn't quite catch that. Could you please say a bit more?",
    enableNormalization: true,
};

/**
 * Explicit context object passed from STT to reasoning.
 * This ensures no information is lost in the pipeline transition.
 */
export interface SpeechContext {
    /** The raw transcribed text */
    rawText: string;
    /** Normalized text (fillers removed, formatted) */
    normalizedText: string;
    /** Overall transcription confidence (0-1) */
    confidence: number;
    /** Detected language (if available) */
    language?: string;
    /** Audio duration in seconds */
    audioDurationSeconds: number;
    /** Whether the input was from silence timeout */
    wasTimeout: boolean;
    /** User-friendly message if input was problematic */
    userMessage?: string;
    /** Timestamp of transcription */
    timestamp: number;
    /** Session ID for continuity tracking */
    sessionId: string;
    /** Emotional indicators from voice (if detectable) */
    voiceIndicators?: VoiceIndicators;
}

/**
 * Voice-based emotional indicators
 */
export interface VoiceIndicators {
    /** Speaking pace: slow, normal, fast */
    pace: 'slow' | 'normal' | 'fast';
    /** Detected pauses pattern */
    pauseFrequency: 'rare' | 'normal' | 'frequent';
    /** Volume consistency */
    volumeConsistency: 'steady' | 'variable';
}

/**
 * Result of speech context processing
 */
export interface SpeechContextResult {
    /** Whether input is valid for processing */
    isValid: boolean;
    /** The speech context (always provided, even for invalid input) */
    context: SpeechContext;
    /** Suggested response if input was invalid */
    suggestedResponse?: string;
}

// ============================================================================
// Speech Context Service
// ============================================================================

/**
 * Handles speech-to-text with silence timeout and explicit context passing.
 */
export class SpeechContextService {
    private config: SpeechContextConfig;
    private speechPort: SpeechPort;
    private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(speechPort: SpeechPort, config?: Partial<SpeechContextConfig>) {
        this.speechPort = speechPort;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Process audio with timeout handling.
     * Returns explicit context for the reasoning pipeline.
     */
    async processAudioWithTimeout(
        audioBuffer: Buffer,
        contentType: string,
        sessionId: string,
        audioDurationMs: number
    ): Promise<SpeechContextResult> {
        const timestamp = Date.now();

        // Check for minimum audio duration
        if (audioDurationMs < this.config.minAudioDurationMs) {
            logger.warn('[SpeechContext] Audio too short', {
                sessionId,
                durationMs: audioDurationMs
            });

            return this.createInvalidResult(sessionId, timestamp, audioDurationMs, 'too_short');
        }

        try {
            // Process with timeout
            const result = await this.processWithTimeout(
                audioBuffer,
                contentType,
                sessionId
            );

            // Check for empty transcription (silence)
            if (!result.text || result.text.trim().length === 0) {
                logger.info('[SpeechContext] Empty transcription (silence)', { sessionId });
                return this.createInvalidResult(sessionId, timestamp, audioDurationMs, 'silence');
            }

            // Create explicit context
            const normalizedText = this.config.enableNormalization
                ? normalizeSpeech(result.text)
                : result.text;

            const context: SpeechContext = {
                rawText: result.text,
                normalizedText,
                confidence: result.confidence,
                language: result.language,
                audioDurationSeconds: audioDurationMs / 1000,
                wasTimeout: false,
                timestamp,
                sessionId,
                voiceIndicators: this.inferVoiceIndicators(result, audioDurationMs),
            };

            logger.info('[SpeechContext] Successfully processed speech', {
                sessionId,
                confidence: result.confidence,
                wordCount: normalizedText.split(/\s+/).length
            });

            return {
                isValid: true,
                context,
            };

        } catch (error) {
            logger.error('[SpeechContext] Processing error', {
                sessionId,
                error: (error as Error).message
            });

            return this.createInvalidResult(sessionId, timestamp, audioDurationMs, 'error');
        }
    }

    /**
     * Start a silence timeout for a session.
     * If user doesn't speak within timeout, callback is invoked.
     */
    startSilenceTimeout(
        sessionId: string,
        onTimeout: (context: SpeechContext) => void
    ): void {
        // Clear any existing timeout
        this.clearSilenceTimeout(sessionId);

        const timeout = setTimeout(() => {
            logger.info('[SpeechContext] Silence timeout triggered', { sessionId });

            const context: SpeechContext = {
                rawText: '',
                normalizedText: '',
                confidence: 0,
                audioDurationSeconds: 0,
                wasTimeout: true,
                userMessage: this.config.silenceTimeoutMessage,
                timestamp: Date.now(),
                sessionId,
            };

            onTimeout(context);
            this.activeTimeouts.delete(sessionId);
        }, this.config.silenceTimeoutMs);

        this.activeTimeouts.set(sessionId, timeout);
    }

    /**
     * Clear silence timeout (called when user speaks).
     */
    clearSilenceTimeout(sessionId: string): void {
        const timeout = this.activeTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.activeTimeouts.delete(sessionId);
        }
    }

    /**
     * Clear all active timeouts (cleanup).
     */
    clearAllTimeouts(): void {
        for (const [sessionId, timeout] of this.activeTimeouts) {
            clearTimeout(timeout);
        }
        this.activeTimeouts.clear();
    }

    /**
     * Get current configuration.
     */
    getConfig(): SpeechContextConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    updateConfig(updates: Partial<SpeechContextConfig>): void {
        this.config = { ...this.config, ...updates };
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private async processWithTimeout(
        audioBuffer: Buffer,
        contentType: string,
        sessionId: string
    ): Promise<SpeechToTextResult> {
        // Clear any silence timeout since user is speaking
        this.clearSilenceTimeout(sessionId);

        // Process the audio
        const result = await this.speechPort.speechToText(audioBuffer, contentType);

        return result;
    }

    private createInvalidResult(
        sessionId: string,
        timestamp: number,
        audioDurationMs: number,
        reason: 'silence' | 'too_short' | 'error'
    ): SpeechContextResult {
        let userMessage: string;
        switch (reason) {
            case 'silence':
                userMessage = this.config.silenceTimeoutMessage;
                break;
            case 'too_short':
                userMessage = this.config.tooShortMessage;
                break;
            case 'error':
                userMessage = "I had trouble hearing that. Could you please try again?";
                break;
        }

        const context: SpeechContext = {
            rawText: '',
            normalizedText: '',
            confidence: 0,
            audioDurationSeconds: audioDurationMs / 1000,
            wasTimeout: reason === 'silence',
            userMessage,
            timestamp,
            sessionId,
        };

        return {
            isValid: false,
            context,
            suggestedResponse: userMessage,
        };
    }

    private inferVoiceIndicators(
        result: SpeechToTextResult,
        audioDurationMs: number
    ): VoiceIndicators | undefined {
        if (!result.segments || result.segments.length === 0) {
            return undefined;
        }

        // Calculate speaking pace
        const wordCount = result.text.split(/\s+/).length;
        const durationSeconds = audioDurationMs / 1000;
        const wordsPerMinute = (wordCount / durationSeconds) * 60;

        let pace: 'slow' | 'normal' | 'fast';
        if (wordsPerMinute < 100) pace = 'slow';
        else if (wordsPerMinute > 160) pace = 'fast';
        else pace = 'normal';

        // Calculate pause frequency from segments
        const segments = result.segments;
        let gapCount = 0;
        for (let i = 1; i < segments.length; i++) {
            const gap = segments[i].startTime - segments[i - 1].endTime;
            if (gap > 0.5) gapCount++; // Gap > 0.5 seconds
        }

        const pauseRatio = segments.length > 1 ? gapCount / (segments.length - 1) : 0;
        let pauseFrequency: 'rare' | 'normal' | 'frequent';
        if (pauseRatio < 0.2) pauseFrequency = 'rare';
        else if (pauseRatio > 0.5) pauseFrequency = 'frequent';
        else pauseFrequency = 'normal';

        return {
            pace,
            pauseFrequency,
            volumeConsistency: 'steady', // Would need audio analysis for real detection
        };
    }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a speech context service with the given speech port.
 */
export function createSpeechContextService(
    speechPort: SpeechPort,
    config?: Partial<SpeechContextConfig>
): SpeechContextService {
    return new SpeechContextService(speechPort, config);
}
