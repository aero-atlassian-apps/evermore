import { SpeechPort, SpeechToTextResult, SpeechOptions } from '../../../core/application/ports/SpeechPort';
import { normalizeSpeech } from '../../../core/application/services/SpeechNormalizer';

export class HuggingFaceAdapter implements SpeechPort {
    private apiKey: string;
    private ttsModel: string;
    private sttModel: string;
    private sttProvider: string;

    constructor() {
        this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
        this.ttsModel = process.env.HF_TTS_MODEL || 'facebook/mms-tts-eng';
        // Use whisper-large-v3 - recommended by HF Inference Providers for ASR
        // Docs: https://huggingface.co/docs/api-inference/tasks/automatic-speech-recognition
        this.sttModel = process.env.HF_STT_MODEL || 'openai/whisper-large-v3';
        // Use hf-inference provider (free tier) - fal-ai requires prepaid credits
        this.sttProvider = process.env.HF_STT_PROVIDER || 'hf-inference';
    }

    async textToSpeech(text: string, options?: SpeechOptions): Promise<Buffer> {
        if (!this.apiKey) {
            console.warn("No HuggingFace API Key, returning mock audio");
            return Buffer.from("mock-audio-hf");
        }

        const response = await fetch(`https://router.huggingface.co/hf-inference/models/${this.ttsModel}`, {
            headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
            method: "POST",
            body: JSON.stringify({ inputs: text }),
        });

        if (!response.ok) {
            throw new Error(`HF TTS failed: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    async speechToText(audioBuffer: Buffer, contentType: string): Promise<SpeechToTextResult> {
        if (!this.apiKey) {
            return {
                text: "[System Alert: Speech API Key is missing. Transcription disabled.]",
                confidence: 0.0,
                normalizedText: "[System Alert: Speech API Key is missing. Transcription disabled.]",
                segments: []
            };
        }

        // HuggingFace Inference Providers API
        // Format: https://router.huggingface.co/{provider}/models/{model}
        // Providers: fal-ai, hf-inference (for ASR tasks)
        const url = `https://router.huggingface.co/${this.sttProvider}/models/${this.sttModel}`;

        // Normalize content type - HF expects no spaces (audio/webm;codecs=opus not audio/webm; codecs=opus)
        const normalizedContentType = (contentType || "audio/wav").replace(/;\s+/g, ';');
        console.log(`[HF STT] Provider: ${this.sttProvider}, Model: ${this.sttModel}, ContentType: ${normalizedContentType}`);

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": normalizedContentType
            },
            method: "POST",
            body: audioBuffer as any,
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Unable to read error body');
            console.error(`HF STT error: ${response.status} ${response.statusText}`, {
                url,
                model: this.sttModel,
                contentType,
                audioSize: audioBuffer.length,
                errorBody
            });

            // If model is loading (503), provide helpful message
            if (response.status === 503) {
                console.log('HF model is loading, returning placeholder...');
                return {
                    text: "I'm still warming up. Please try again in a moment.",
                    confidence: 0.5,
                    normalizedText: "I'm still warming up. Please try again in a moment.",
                    segments: []
                };
            }

            // HuggingFace deprecated their free inference API (410 Gone) or model not found (404)
            // Return a graceful message instead of crashing
            if (response.status === 410 || response.status === 404) {
                console.warn('HuggingFace STT API is unavailable (deprecated or model not found).');
                return {
                    text: "",
                    confidence: 0.0,
                    normalizedText: "",
                    segments: []
                };
            }

            // BUG-001 FIX: Handle 400 Bad Request gracefully (malformed audio)
            // Return empty transcription so user can type message instead
            if (response.status === 400) {
                console.warn('HuggingFace STT: Audio format not accepted. User can type message instead.');
                return {
                    text: "",
                    confidence: 0.0,
                    normalizedText: "",
                    segments: []
                };
            }

            throw new Error(`HF STT failed: ${response.statusText} - ${errorBody}`);
        }

        const result = await response.json();
        const text = result.text || "";

        return {
            text,
            confidence: 0.8,
            normalizedText: normalizeSpeech(text),
            segments: []
        };
    }
}
