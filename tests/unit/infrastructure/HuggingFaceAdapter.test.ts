import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HuggingFaceAdapter } from '../../../lib/infrastructure/adapters/speech/HuggingFaceAdapter';

// Mock fetch globally
global.fetch = vi.fn();

describe('HuggingFaceAdapter', () => {
    let adapter: HuggingFaceAdapter;

    beforeEach(() => {
        process.env.HUGGINGFACE_API_KEY = 'test-key';
        adapter = new HuggingFaceAdapter();
        vi.resetAllMocks();
    });

    it('should call HF API for TTS', async () => {
        const mockResponse = new Response(Buffer.from('audio-data'));
        (global.fetch as any).mockResolvedValue(mockResponse);

        const result = await adapter.textToSpeech('Hello world');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('https://router.huggingface.co/'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ inputs: 'Hello world' })
            })
        );
        expect(result).toBeInstanceOf(Buffer);
    });

    it('should call HF API for STT', async () => {
        const mockResponse = new Response(JSON.stringify({ text: 'Transcribed text' }));
        (global.fetch as any).mockResolvedValue(mockResponse);

        const audio = Buffer.from('audio-data');
        const result = await adapter.speechToText(audio, 'audio/wav');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('https://router.huggingface.co/'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'Content-Type': 'audio/wav' })
            })
        );
        expect(result.text).toBe('Transcribed text');
    });

    it('should return mock if no API key', async () => {
        process.env.HUGGINGFACE_API_KEY = '';
        const noKeyAdapter = new HuggingFaceAdapter();

        const result = await noKeyAdapter.textToSpeech('Test');
        expect(result.toString()).toContain('mock-audio-hf');
    });
});
