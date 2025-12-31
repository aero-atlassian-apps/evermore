import { SpeechPort, SpeechToTextResult, SpeechOptions } from '../../../core/application/ports/SpeechPort';

export class MockSpeechAdapter implements SpeechPort {
    async textToSpeech(text: string, options?: SpeechOptions): Promise<Buffer> {
        console.log(`[MockSpeechAdapter] Generating speech for: "${text.substring(0, 50)}..."`);
        return Buffer.from([]); // Return empty buffer
    }

    async speechToText(audioBuffer: Buffer, contentType: string): Promise<SpeechToTextResult> {
        console.log(`[MockSpeechAdapter] Transcribing audio of size: ${audioBuffer.length}`);
        return {
            text: "This is a mock transcription.",
            confidence: 0.99,
            segments: [],
            normalizedText: "This is a mock transcription."
        };
    }
}
