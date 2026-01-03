/**
 * Audio Emotion Analyzer Adapter
 * 
 * Implements AudioEmotionPort using local acoustic feature extraction.
 * Provides emotion detection from audio without external API dependencies.
 * 
 * @module AudioEmotionAnalyzer
 */

import { logger } from '@/lib/core/application/Logger';
import type {
    AudioEmotionPort,
    AudioData,
    AudioEmotionResult,
    ParalinguisticFeatures
} from '@/lib/core/application/ports/AudioEmotionPort';
import { VoiceProsody } from '@/lib/core/application/agent/persona/EmpathyEngine';
import { AcousticFeatureExtractor } from '@/lib/core/application/services/audio/AcousticFeatureExtractor';

// ============================================================================
// Audio Emotion Analyzer Adapter
// ============================================================================

/**
 * Local acoustic-based emotion analyzer.
 * 
 * Uses signal processing to extract emotion-relevant features from audio.
 * No external API dependencies - runs entirely locally.
 */
export class AudioEmotionAnalyzer implements AudioEmotionPort {
    private featureExtractor: AcousticFeatureExtractor;

    constructor() {
        this.featureExtractor = new AcousticFeatureExtractor();
    }

    /**
     * Analyze audio for emotional content.
     */
    async analyzeAudio(audioData: AudioData): Promise<AudioEmotionResult> {
        logger.debug('[AudioEmotionAnalyzer] Analyzing audio', {
            duration: audioData.duration,
            sampleRate: audioData.sampleRate,
        });

        try {
            // Extract acoustic features
            const features = await this.featureExtractor.extractFeatures(audioData);

            // Get samples for paralinguistic detection
            const samples = this.getFloatSamples(audioData);
            const paralinguistics = await this.featureExtractor.detectParalinguistics(
                samples,
                audioData.sampleRate
            );

            // Map to emotion
            const result = this.featureExtractor.mapToEmotion(features, paralinguistics);

            logger.debug('[AudioEmotionAnalyzer] Analysis complete', {
                emotion: result.emotion,
                confidence: result.confidence,
                valence: result.valence,
                arousal: result.arousal,
            });

            return result;
        } catch (error) {
            logger.error('[AudioEmotionAnalyzer] Analysis failed', { error });
            throw error;
        }
    }

    /**
     * Extract voice prosody features.
     */
    async extractProsody(audioData: AudioData): Promise<VoiceProsody> {
        const features = await this.featureExtractor.extractFeatures(audioData);
        const samples = this.getFloatSamples(audioData);
        const paralinguistics = await this.featureExtractor.detectParalinguistics(
            samples,
            audioData.sampleRate
        );

        return this.featureExtractor.featuresToProsody(features, paralinguistics);
    }

    /**
     * Detect paralinguistic features.
     */
    async detectParalinguistics(audioData: AudioData): Promise<ParalinguisticFeatures> {
        const samples = this.getFloatSamples(audioData);
        return this.featureExtractor.detectParalinguistics(samples, audioData.sampleRate);
    }

    /**
     * Check if analyzer is available.
     */
    async isAvailable(): Promise<boolean> {
        return true; // Local processing, always available
    }

    /**
     * Get float samples from audio data.
     */
    private getFloatSamples(audioData: AudioData): Float32Array {
        if (audioData.buffer instanceof Float32Array) {
            return audioData.buffer;
        }
        const view = new DataView(audioData.buffer);
        const samples = new Float32Array(audioData.buffer.byteLength / 2);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = view.getInt16(i * 2, true) / 32768;
        }
        return samples;
    }
}

// Export singleton
export const audioEmotionAnalyzer = new AudioEmotionAnalyzer();

// Export factory
export function createAudioEmotionAnalyzer(): AudioEmotionPort {
    return new AudioEmotionAnalyzer();
}
