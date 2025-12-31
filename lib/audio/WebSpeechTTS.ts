/**
 * Web Speech API TTS Implementation
 * 
 * Browser-based fallback when external TTS providers are unavailable.
 * Works offline but with limited voice quality.
 */

import { TTSService, TTSVoice, TTSOptions, TTSResult } from './TTSService';

export class WebSpeechTTS implements TTSService {
    readonly providerName = 'Web Speech API';
    private synth: SpeechSynthesis | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.synth = window.speechSynthesis;
        }
    }

    async isAvailable(): Promise<boolean> {
        return this.synth !== null && 'speechSynthesis' in window;
    }

    async getVoices(): Promise<TTSVoice[]> {
        if (!this.synth) return [];

        return new Promise((resolve) => {
            const voices = this.synth!.getVoices();
            if (voices.length > 0) {
                resolve(this.mapVoices(voices));
            } else {
                // Voices load asynchronously in some browsers
                this.synth!.onvoiceschanged = () => {
                    resolve(this.mapVoices(this.synth!.getVoices()));
                };
            }
        });
    }

    private mapVoices(voices: SpeechSynthesisVoice[]): TTSVoice[] {
        return voices.map(v => ({
            id: v.voiceURI,
            name: v.name,
            language: v.lang,
            gender: this.inferGender(v.name),
        }));
    }

    private inferGender(name: string): 'male' | 'female' | 'neutral' {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('male') || lowerName.includes('david') || lowerName.includes('james')) {
            return 'male';
        }
        if (lowerName.includes('female') || lowerName.includes('samantha') || lowerName.includes('karen')) {
            return 'female';
        }
        return 'neutral';
    }

    async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
        if (!this.synth) {
            throw new Error('Web Speech API not available');
        }

        return new Promise((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(text);

            // Apply options
            if (options?.speed) utterance.rate = options.speed;
            if (options?.pitch) utterance.pitch = options.pitch;

            if (options?.voiceId) {
                const voices = this.synth!.getVoices();
                const voice = voices.find(v => v.voiceURI === options.voiceId);
                if (voice) utterance.voice = voice;
            }

            // For Web Speech API, we can't get audio data directly
            // We'll simulate the audio duration
            const wordCount = text.split(/\s+/).length;
            const wordsPerSecond = (options?.speed || 1) * 2.5;
            const estimatedDuration = wordCount / wordsPerSecond;

            utterance.onend = () => {
                // Create a silent audio buffer as placeholder
                // Real audio would require MediaRecorder
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const buffer = audioContext.createBuffer(1, audioContext.sampleRate * estimatedDuration, audioContext.sampleRate);

                resolve({
                    audioData: new ArrayBuffer(0), // Web Speech doesn't provide audio data
                    mimeType: 'audio/wav',
                    duration: estimatedDuration,
                    provider: this.providerName,
                });
            };

            utterance.onerror = (event) => {
                reject(new Error(`Speech synthesis error: ${event.error}`));
            };

            this.synth!.speak(utterance);
        });
    }

    /**
     * Direct playback using Web Speech API (no audio file needed)
     */
    speak(text: string, options?: TTSOptions): Promise<void> {
        if (!this.synth) {
            return Promise.reject(new Error('Web Speech API not available'));
        }

        return new Promise((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(text);

            if (options?.speed) utterance.rate = options.speed;
            if (options?.pitch) utterance.pitch = options.pitch;

            if (options?.voiceId) {
                const voices = this.synth!.getVoices();
                const voice = voices.find(v => v.voiceURI === options.voiceId);
                if (voice) utterance.voice = voice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (e) => reject(new Error(`Speech error: ${e.error}`));

            this.synth!.speak(utterance);
        });
    }

    stop(): void {
        this.synth?.cancel();
    }
}
