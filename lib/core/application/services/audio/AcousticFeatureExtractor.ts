/**
 * Acoustic Feature Extractor
 * 
 * Extracts emotion-relevant acoustic features from audio data.
 * Uses signal processing techniques for pitch, energy, and spectral analysis.
 * 
 * Features extracted:
 * - Pitch (F0): Fundamental frequency
 * - Energy: RMS amplitude and variance
 * - Speech rate: Estimated syllables and pauses
 * - Voice quality: Jitter, shimmer approximations
 * - Spectral: Centroid, bandwidth, MFCCs
 * 
 * @module AcousticFeatureExtractor
 */

import { logger } from '@/lib/core/application/Logger';
import type {
    AudioData,
    AcousticFeatures,
    ParalinguisticFeatures,
    AudioEmotionResult
} from '@/lib/core/application/ports/AudioEmotionPort';
import { EmotionCategory, VoiceProsody } from '@/lib/core/application/agent/persona/EmpathyEngine';

// ============================================================================
// Constants
// ============================================================================

/** Typical speech frequency range */
const PITCH_MIN_HZ = 75;
const PITCH_MAX_HZ = 500;

/** Frame size for analysis (in samples at 16kHz) */
const FRAME_SIZE = 512;
const HOP_SIZE = 256;

/** MFCC configuration */
const NUM_MFCCS = 13;
const NUM_MEL_FILTERS = 26;

// ============================================================================
// Acoustic Feature Extractor
// ============================================================================

export class AcousticFeatureExtractor {
    /**
     * Extract all acoustic features from audio data.
     */
    async extractFeatures(audioData: AudioData): Promise<AcousticFeatures> {
        const samples = this.getFloatSamples(audioData);
        const sampleRate = audioData.sampleRate;

        logger.debug('[AcousticFeatureExtractor] Extracting features', {
            duration: audioData.duration,
            sampleRate,
            samples: samples.length,
        });

        // Extract all feature categories
        const pitch = this.extractPitchFeatures(samples, sampleRate);
        const energy = this.extractEnergyFeatures(samples);
        const speechRate = this.extractSpeechRate(samples, sampleRate);
        const pauses = this.extractPausePatterns(samples, sampleRate);
        const voiceQuality = this.extractVoiceQuality(samples, sampleRate);
        const spectral = this.extractSpectralFeatures(samples, sampleRate);

        return {
            pitch,
            energy,
            speechRate,
            pauses,
            voiceQuality,
            spectral,
        };
    }

    /**
     * Extract pitch (F0) features using autocorrelation.
     */
    private extractPitchFeatures(
        samples: Float32Array,
        sampleRate: number
    ): AcousticFeatures['pitch'] {
        const pitchValues: number[] = [];
        const numFrames = Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE);

        for (let i = 0; i < numFrames; i++) {
            const start = i * HOP_SIZE;
            const frame = samples.slice(start, start + FRAME_SIZE);
            const pitch = this.detectPitchAutocorrelation(frame, sampleRate);
            if (pitch > 0) {
                pitchValues.push(pitch);
            }
        }

        if (pitchValues.length === 0) {
            return { mean: 0, min: 0, max: 0, stdDev: 0, contour: [] };
        }

        const mean = pitchValues.reduce((a, b) => a + b, 0) / pitchValues.length;
        const min = Math.min(...pitchValues);
        const max = Math.max(...pitchValues);
        const variance = pitchValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitchValues.length;
        const stdDev = Math.sqrt(variance);

        // Downsample contour for storage
        const contour = this.downsampleArray(pitchValues, 50);

        return { mean, min, max, stdDev, contour };
    }

    /**
     * Detect pitch using autocorrelation method.
     */
    private detectPitchAutocorrelation(frame: Float32Array, sampleRate: number): number {
        const minPeriod = Math.floor(sampleRate / PITCH_MAX_HZ);
        const maxPeriod = Math.floor(sampleRate / PITCH_MIN_HZ);

        // Apply window
        const windowed = this.applyHammingWindow(frame);

        // Compute autocorrelation
        let maxCorr = 0;
        let bestPeriod = 0;

        for (let lag = minPeriod; lag <= maxPeriod; lag++) {
            let corr = 0;
            for (let i = 0; i < frame.length - lag; i++) {
                corr += windowed[i] * windowed[i + lag];
            }
            if (corr > maxCorr) {
                maxCorr = corr;
                bestPeriod = lag;
            }
        }

        // Check if voiced (has strong correlation)
        const r0 = this.computeAutocorrelation(windowed, 0);
        if (maxCorr / r0 < 0.3) {
            return 0; // Unvoiced
        }

        return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
    }

    /**
     * Extract energy/intensity features.
     */
    private extractEnergyFeatures(samples: Float32Array): AcousticFeatures['energy'] {
        let sumSquares = 0;
        let max = 0;

        for (let i = 0; i < samples.length; i++) {
            const abs = Math.abs(samples[i]);
            sumSquares += samples[i] * samples[i];
            if (abs > max) max = abs;
        }

        const rms = Math.sqrt(sumSquares / samples.length);
        const mean = samples.reduce((a, b) => a + Math.abs(b), 0) / samples.length;

        // Compute variance
        let varianceSum = 0;
        for (let i = 0; i < samples.length; i++) {
            varianceSum += Math.pow(Math.abs(samples[i]) - mean, 2);
        }
        const variance = varianceSum / samples.length;

        return { mean, max, rms, variance };
    }

    /**
     * Estimate speech rate from audio.
     */
    private extractSpeechRate(
        samples: Float32Array,
        sampleRate: number
    ): AcousticFeatures['speechRate'] {
        // Estimate syllables by counting energy peaks
        const frameEnergies: number[] = [];
        const numFrames = Math.floor(samples.length / HOP_SIZE);

        for (let i = 0; i < numFrames; i++) {
            const start = i * HOP_SIZE;
            const end = Math.min(start + FRAME_SIZE, samples.length);
            let energy = 0;
            for (let j = start; j < end; j++) {
                energy += samples[j] * samples[j];
            }
            frameEnergies.push(energy / (end - start));
        }

        // Count peaks (syllable nuclei)
        const threshold = this.computeEnergyThreshold(frameEnergies);
        let syllableCount = 0;
        let inPeak = false;

        for (let i = 0; i < frameEnergies.length; i++) {
            if (frameEnergies[i] > threshold && !inPeak) {
                syllableCount++;
                inPeak = true;
            } else if (frameEnergies[i] < threshold * 0.5) {
                inPeak = false;
            }
        }

        const durationSeconds = samples.length / sampleRate;
        const syllablesPerSecond = durationSeconds > 0 ? syllableCount / durationSeconds : 0;
        const wordsPerMinute = syllablesPerSecond * 60 / 1.5; // Avg 1.5 syllables/word
        const articulationRate = syllablesPerSecond * 1.2; // Excluding pauses

        return { wordsPerMinute, syllablesPerSecond, articulationRate };
    }

    /**
     * Extract pause patterns from audio.
     */
    private extractPausePatterns(
        samples: Float32Array,
        sampleRate: number
    ): AcousticFeatures['pauses'] {
        const silenceThreshold = 0.01;
        const minPauseDuration = 0.15; // 150ms minimum
        const minPauseSamples = minPauseDuration * sampleRate;

        let pauseCount = 0;
        let totalPauseDuration = 0;
        let currentPauseLength = 0;
        const pauseDurations: number[] = [];

        for (let i = 0; i < samples.length; i++) {
            if (Math.abs(samples[i]) < silenceThreshold) {
                currentPauseLength++;
            } else {
                if (currentPauseLength >= minPauseSamples) {
                    pauseCount++;
                    const duration = currentPauseLength / sampleRate;
                    totalPauseDuration += duration;
                    pauseDurations.push(duration);
                }
                currentPauseLength = 0;
            }
        }

        // Check final segment
        if (currentPauseLength >= minPauseSamples) {
            pauseCount++;
            totalPauseDuration += currentPauseLength / sampleRate;
            pauseDurations.push(currentPauseLength / sampleRate);
        }

        const meanDuration = pauseDurations.length > 0
            ? pauseDurations.reduce((a, b) => a + b, 0) / pauseDurations.length
            : 0;
        const audioSeconds = samples.length / sampleRate;
        const pauseRatio = audioSeconds > 0 ? totalPauseDuration / audioSeconds : 0;

        return {
            count: pauseCount,
            meanDuration,
            totalDuration: totalPauseDuration,
            pauseRatio,
        };
    }

    /**
     * Extract voice quality metrics (jitter, shimmer approximations).
     */
    private extractVoiceQuality(
        samples: Float32Array,
        sampleRate: number
    ): AcousticFeatures['voiceQuality'] {
        // Simplified jitter/shimmer estimation
        const periods: number[] = [];
        const amplitudes: number[] = [];

        // Find zero crossings for period estimation
        let lastZeroCrossing = 0;
        for (let i = 1; i < samples.length; i++) {
            if (samples[i - 1] <= 0 && samples[i] > 0) {
                if (lastZeroCrossing > 0) {
                    periods.push((i - lastZeroCrossing) / sampleRate);
                }
                lastZeroCrossing = i;

                // Find max amplitude in this period
                let maxAmp = 0;
                for (let j = lastZeroCrossing; j < i && j < samples.length; j++) {
                    maxAmp = Math.max(maxAmp, Math.abs(samples[j]));
                }
                amplitudes.push(maxAmp);
            }
        }

        // Jitter: variation in periods
        let jitter = 0;
        if (periods.length > 1) {
            let sumDiff = 0;
            for (let i = 1; i < periods.length; i++) {
                sumDiff += Math.abs(periods[i] - periods[i - 1]);
            }
            const meanPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
            jitter = meanPeriod > 0 ? (sumDiff / (periods.length - 1)) / meanPeriod : 0;
        }

        // Shimmer: variation in amplitudes
        let shimmer = 0;
        if (amplitudes.length > 1) {
            let sumDiff = 0;
            for (let i = 1; i < amplitudes.length; i++) {
                sumDiff += Math.abs(amplitudes[i] - amplitudes[i - 1]);
            }
            const meanAmp = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
            shimmer = meanAmp > 0 ? (sumDiff / (amplitudes.length - 1)) / meanAmp : 0;
        }

        // Harmonics-to-noise ratio (simplified)
        const hnr = this.estimateHNR(samples, sampleRate);

        return { jitter, shimmer, harmonicsToNoiseRatio: hnr };
    }

    /**
     * Extract spectral features.
     */
    private extractSpectralFeatures(
        samples: Float32Array,
        sampleRate: number
    ): AcousticFeatures['spectral'] {
        // Compute magnitude spectrum using simple DFT
        const fftSize = 1024;
        const spectrum = this.computeMagnitudeSpectrum(samples.slice(0, fftSize));
        const freqBinSize = sampleRate / fftSize;

        // Spectral centroid
        let weightedSum = 0;
        let totalMag = 0;
        for (let i = 0; i < spectrum.length; i++) {
            const freq = i * freqBinSize;
            weightedSum += freq * spectrum[i];
            totalMag += spectrum[i];
        }
        const centroid = totalMag > 0 ? weightedSum / totalMag : 0;

        // Spectral bandwidth
        let bandwidthSum = 0;
        for (let i = 0; i < spectrum.length; i++) {
            const freq = i * freqBinSize;
            bandwidthSum += Math.pow(freq - centroid, 2) * spectrum[i];
        }
        const bandwidth = totalMag > 0 ? Math.sqrt(bandwidthSum / totalMag) : 0;

        // Spectral rolloff (frequency below which 85% of energy is concentrated)
        const targetEnergy = totalMag * 0.85;
        let cumEnergy = 0;
        let rolloff = 0;
        for (let i = 0; i < spectrum.length; i++) {
            cumEnergy += spectrum[i];
            if (cumEnergy >= targetEnergy) {
                rolloff = i * freqBinSize;
                break;
            }
        }

        // Spectral flux (simplified - single frame)
        const flux = spectrum.reduce((sum, m) => sum + m, 0) / spectrum.length;

        // MFCCs (simplified approximation)
        const mfccs = this.computeMFCCs(samples, sampleRate);

        return { centroid, bandwidth, rolloff, flux, mfccs };
    }

    /**
     * Detect paralinguistic features.
     */
    async detectParalinguistics(samples: Float32Array, sampleRate: number): Promise<ParalinguisticFeatures> {
        const features = await this.extractFeatures({
            buffer: samples,
            sampleRate,
            channels: 1,
            duration: samples.length / sampleRate,
            format: 'pcm'
        });

        // Detect laughter: high pitch variation + high energy variation
        const hasLaughter = features.pitch.stdDev > 40 && features.energy.variance > 0.01;

        // Detect crying: high pitch + tremor-like patterns
        const hasCrying = features.voiceQuality.shimmer > 0.15 && features.pitch.mean > 200;

        // Detect sighing: falling pitch contour + long exhale
        const hasSighing = features.pauses.meanDuration > 0.5 &&
            features.pitch.contour.length > 2 &&
            features.pitch.contour[0] > features.pitch.contour[features.pitch.contour.length - 1];

        // Detect tremor: high jitter
        const hasTremor = features.voiceQuality.jitter > 0.02;

        // Breathing rate from pause patterns
        let breathingRate: 'slow' | 'normal' | 'fast' | 'irregular' = 'normal';
        if (features.pauses.count < 2) breathingRate = 'slow';
        else if (features.pauses.count > 10) breathingRate = 'fast';
        else if (features.pauses.pauseRatio > 0.4) breathingRate = 'irregular';

        return {
            hasLaughter,
            hasCrying,
            hasSighing,
            hasTremor,
            breathingRate,
            hasThroatClearing: false, // Requires more sophisticated detection
            confidences: {
                laughter: hasLaughter ? 0.7 : 0.1,
                crying: hasCrying ? 0.7 : 0.1,
                sighing: hasSighing ? 0.6 : 0.1,
                tremor: hasTremor ? 0.8 : 0.1,
            },
        };
    }

    /**
     * Map acoustic features to emotion.
     */
    mapToEmotion(features: AcousticFeatures, paralinguistics: ParalinguisticFeatures): AudioEmotionResult {
        let emotion = EmotionCategory.NEUTRAL;
        let valence = 0;
        let arousal = 0.5;
        let dominance = 0.5;
        let confidence = 0.5;

        // High-confidence paralinguistic detections
        if (paralinguistics.hasCrying) {
            emotion = EmotionCategory.GRIEF;
            valence = -0.8;
            arousal = 0.6;
            confidence = 0.8;
        } else if (paralinguistics.hasLaughter) {
            emotion = EmotionCategory.JOY;
            valence = 0.9;
            arousal = 0.8;
            confidence = 0.8;
        } else if (paralinguistics.hasTremor) {
            emotion = EmotionCategory.FEAR;
            valence = -0.6;
            arousal = 0.7;
            confidence = 0.7;
        }
        // Acoustic feature-based detection
        else if (features.pitch.mean < 120 && features.energy.rms < 0.1 && features.speechRate.wordsPerMinute < 100) {
            emotion = EmotionCategory.SADNESS;
            valence = -0.6;
            arousal = 0.3;
            confidence = 0.6;
        } else if (features.speechRate.wordsPerMinute > 180 && features.pitch.stdDev > 30) {
            emotion = EmotionCategory.ANXIETY;
            valence = -0.4;
            arousal = 0.8;
            confidence = 0.6;
        } else if (features.pitch.mean > 180 && features.energy.rms > 0.15) {
            emotion = EmotionCategory.JOY;
            valence = 0.7;
            arousal = 0.7;
            confidence = 0.5;
        } else if (features.pitch.mean > 150 && features.energy.max > 0.8) {
            emotion = EmotionCategory.ANGER;
            valence = -0.5;
            arousal = 0.9;
            dominance = 0.8;
            confidence = 0.5;
        }

        return {
            emotion,
            confidence,
            valence,
            arousal,
            dominance,
            features,
            paralinguistics,
            timestamp: Date.now(),
        };
    }

    /**
     * Extract VoiceProsody from acoustic features.
     */
    featuresToProsody(features: AcousticFeatures, paralinguistics: ParalinguisticFeatures): VoiceProsody {
        return {
            speakingRate: features.speechRate.wordsPerMinute,
            pitchVariation: features.pitch.stdDev / 50, // Normalize to 0-1
            volume: Math.min(1, features.energy.rms * 5),
            pauseFrequency: features.pauses.pauseRatio,
            hasTremor: paralinguistics.hasTremor,
            hasSighing: paralinguistics.hasSighing,
            hasCrying: paralinguistics.hasCrying,
            hasLaughter: paralinguistics.hasLaughter,
        };
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    private getFloatSamples(audioData: AudioData): Float32Array {
        if (audioData.buffer instanceof Float32Array) {
            return audioData.buffer;
        }
        // Convert ArrayBuffer to Float32Array (assuming 16-bit PCM)
        const view = new DataView(audioData.buffer);
        const samples = new Float32Array(audioData.buffer.byteLength / 2);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = view.getInt16(i * 2, true) / 32768;
        }
        return samples;
    }

    private applyHammingWindow(frame: Float32Array): Float32Array {
        const windowed = new Float32Array(frame.length);
        for (let i = 0; i < frame.length; i++) {
            windowed[i] = frame[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (frame.length - 1)));
        }
        return windowed;
    }

    private computeAutocorrelation(samples: Float32Array, lag: number): number {
        let sum = 0;
        for (let i = 0; i < samples.length - lag; i++) {
            sum += samples[i] * samples[i + lag];
        }
        return sum;
    }

    private downsampleArray(arr: number[], targetSize: number): number[] {
        if (arr.length <= targetSize) return arr;
        const step = arr.length / targetSize;
        const result: number[] = [];
        for (let i = 0; i < targetSize; i++) {
            result.push(arr[Math.floor(i * step)]);
        }
        return result;
    }

    private computeEnergyThreshold(energies: number[]): number {
        const sorted = [...energies].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.3)]; // 30th percentile
    }

    private estimateHNR(samples: Float32Array, sampleRate: number): number {
        // Simplified HNR estimation using autocorrelation
        const frame = samples.slice(0, Math.min(FRAME_SIZE * 4, samples.length));
        const windowed = this.applyHammingWindow(frame);

        const r0 = this.computeAutocorrelation(windowed, 0);
        const minPeriod = Math.floor(sampleRate / PITCH_MAX_HZ);
        const maxPeriod = Math.floor(sampleRate / PITCH_MIN_HZ);

        let maxR = 0;
        for (let lag = minPeriod; lag <= maxPeriod && lag < windowed.length; lag++) {
            const r = this.computeAutocorrelation(windowed, lag);
            if (r > maxR) maxR = r;
        }

        if (r0 <= maxR) return 0;
        return 10 * Math.log10(maxR / (r0 - maxR + 0.0001));
    }

    private computeMagnitudeSpectrum(samples: Float32Array): Float32Array {
        // Simple DFT (for small audio clips)
        const N = samples.length;
        const spectrum = new Float32Array(N / 2);

        for (let k = 0; k < N / 2; k++) {
            let real = 0;
            let imag = 0;
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += samples[n] * Math.cos(angle);
                imag -= samples[n] * Math.sin(angle);
            }
            spectrum[k] = Math.sqrt(real * real + imag * imag);
        }

        return spectrum;
    }

    private computeMFCCs(samples: Float32Array, sampleRate: number): number[] {
        // Simplified MFCC computation (normally would use FFT + mel filterbank + DCT)
        const spectrum = this.computeMagnitudeSpectrum(samples.slice(0, 1024));
        const mfccs: number[] = [];

        // Create simplified mel-spaced bins
        for (let i = 0; i < NUM_MFCCS; i++) {
            const start = Math.floor((spectrum.length * i) / NUM_MFCCS);
            const end = Math.floor((spectrum.length * (i + 1)) / NUM_MFCCS);
            let sum = 0;
            for (let j = start; j < end; j++) {
                sum += spectrum[j];
            }
            mfccs.push(Math.log(sum / (end - start) + 0.0001));
        }

        return mfccs;
    }
}

// Export singleton instance
export const acousticFeatureExtractor = new AcousticFeatureExtractor();
