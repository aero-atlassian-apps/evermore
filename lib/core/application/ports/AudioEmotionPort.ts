/**
 * Audio Emotion Analysis Port
 * 
 * Defines the interface for analyzing emotions from audio data.
 * Implementations can use acoustic feature extraction, ML models, or external APIs.
 * 
 * @module AudioEmotionPort
 */

import { EmotionCategory, VoiceProsody } from '../agent/persona/EmpathyEngine';

// ============================================================================
// Types
// ============================================================================

/**
 * Raw audio data for analysis.
 */
export interface AudioData {
    /** Audio buffer (PCM data) */
    buffer: ArrayBuffer | Float32Array;
    /** Sample rate in Hz */
    sampleRate: number;
    /** Number of channels */
    channels: number;
    /** Duration in seconds */
    duration: number;
    /** Audio format */
    format: 'pcm' | 'wav' | 'webm' | 'mp3';
}

/**
 * Acoustic features extracted from audio.
 */
export interface AcousticFeatures {
    /** Fundamental frequency (pitch) in Hz */
    pitch: {
        mean: number;
        min: number;
        max: number;
        stdDev: number;
        contour: number[];
    };
    /** Energy/intensity */
    energy: {
        mean: number;
        max: number;
        rms: number;
        variance: number;
    };
    /** Speech rate */
    speechRate: {
        wordsPerMinute: number;
        syllablesPerSecond: number;
        articulationRate: number;
    };
    /** Pause patterns */
    pauses: {
        count: number;
        meanDuration: number;
        totalDuration: number;
        pauseRatio: number;
    };
    /** Voice quality metrics */
    voiceQuality: {
        jitter: number;
        shimmer: number;
        harmonicsToNoiseRatio: number;
    };
    /** Spectral features */
    spectral: {
        centroid: number;
        bandwidth: number;
        rolloff: number;
        flux: number;
        mfccs: number[];
    };
}

/**
 * Paralinguistic features (non-verbal vocal cues).
 */
export interface ParalinguisticFeatures {
    /** Laughter detected */
    hasLaughter: boolean;
    /** Crying detected */
    hasCrying: boolean;
    /** Sighing detected */
    hasSighing: boolean;
    /** Voice tremor detected */
    hasTremor: boolean;
    /** Breath patterns */
    breathingRate: 'slow' | 'normal' | 'fast' | 'irregular';
    /** Throat clearing */
    hasThroatClearing: boolean;
    /** Confidence scores for each detection */
    confidences: Record<string, number>;
}

/**
 * Result of audio emotion analysis.
 */
export interface AudioEmotionResult {
    /** Primary detected emotion */
    emotion: EmotionCategory;
    /** Confidence in detection (0-1) */
    confidence: number;
    /** Emotional valence (-1 to 1) */
    valence: number;
    /** Arousal level (0-1) */
    arousal: number;
    /** Dominance level (0-1) */
    dominance: number;
    /** Extracted acoustic features */
    features: AcousticFeatures;
    /** Paralinguistic features */
    paralinguistics: ParalinguisticFeatures;
    /** Analysis timestamp */
    timestamp: number;
}

// ============================================================================
// Port Interface
// ============================================================================

/**
 * Port for audio emotion analysis.
 * 
 * Analyzers implement this interface to provide emotion detection from audio.
 * The clean architecture allows swapping implementations (local vs. API-based).
 */
export interface AudioEmotionPort {
    /**
     * Analyze audio for emotional content.
     * 
     * @param audioData - Raw audio data to analyze
     * @returns Promise with emotion analysis result
     */
    analyzeAudio(audioData: AudioData): Promise<AudioEmotionResult>;

    /**
     * Extract voice prosody features.
     * 
     * @param audioData - Raw audio data
     * @returns Promise with prosody features
     */
    extractProsody(audioData: AudioData): Promise<VoiceProsody>;

    /**
     * Detect paralinguistic features.
     * 
     * @param audioData - Raw audio data
     * @returns Promise with paralinguistic features
     */
    detectParalinguistics(audioData: AudioData): Promise<ParalinguisticFeatures>;

    /**
     * Check if the analyzer is available.
     */
    isAvailable(): Promise<boolean>;
}

/**
 * Factory function type for creating audio emotion analyzers.
 */
export type AudioEmotionAnalyzerFactory = () => AudioEmotionPort;
