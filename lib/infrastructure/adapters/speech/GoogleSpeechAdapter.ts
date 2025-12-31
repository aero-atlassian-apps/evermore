/**
 * Google Cloud Speech-to-Text Adapter
 * 
 * Uses Google Cloud Speech-to-Text API for converting audio to text.
 * Works with the same credentials as Vertex AI (GOOGLE_APPLICATION_CREDENTIALS).
 */

import { SpeechPort, SpeechToTextResult, SpeechOptions } from '../../../core/application/ports/SpeechPort';

export class GoogleSpeechAdapter implements SpeechPort {
    private projectId: string;

    constructor() {
        this.projectId = process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
        if (!this.projectId) {
            console.warn('[GoogleSpeechAdapter] No project ID configured');
        }
    }

    async textToSpeech(text: string, options?: SpeechOptions): Promise<Buffer> {
        if (!this.projectId) {
            throw new Error('GoogleSpeechAdapter: GOOGLE_PROJECT_ID is required');
        }

        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token) {
            throw new Error('Failed to get access token for Text-to-Speech');
        }

        // Map style to Google Voice selection if needed, or use default
        // 'emotional' -> could map to a specific WaveNet or Neural2 voice if desired
        const voiceName = options?.style === 'emotional' ? 'en-US-Neural2-F' : 'en-US-Neural2-D';

        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text },
                    voice: { languageCode: 'en-US', name: voiceName },
                    audioConfig: { audioEncoding: 'MP3' },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Text-to-Speech API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        if (!data.audioContent) {
            throw new Error('No audio content returned from Google TTS');
        }

        return Buffer.from(data.audioContent, 'base64');
    }

    async speechToText(audioBuffer: Buffer, contentType: string): Promise<SpeechToTextResult> {
        if (!this.projectId) {
            throw new Error('GoogleSpeechAdapter: GOOGLE_PROJECT_ID is required');
        }

        // Use REST API directly (no optional SDK dependency)
        return await this.speechToTextREST(audioBuffer, contentType);
    }

    private async speechToTextREST(audioBuffer: Buffer, contentType: string): Promise<SpeechToTextResult> {
        // Use Google Cloud Speech-to-Text REST API directly
        const { GoogleAuth } = await import('google-auth-library');

        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token) {
            throw new Error('Failed to get access token for Speech-to-Text');
        }

        // Determine encoding - let Google auto-detect for WEBM_OPUS
        let encoding = 'LINEAR16';
        let sampleRateHertz: number | undefined = 16000;
        let audioChannelCount: number | undefined = undefined;

        if (contentType.includes('webm') || contentType.includes('opus')) {
            encoding = 'WEBM_OPUS';
            // WEBM from browser is typically 48kHz stereo
            sampleRateHertz = 48000;
            audioChannelCount = 2; // Browser records in stereo
        } else if (contentType.includes('mp3') || contentType.includes('mpeg')) {
            encoding = 'MP3';
            sampleRateHertz = undefined; // Auto-detect
        }

        // Build config, omitting undefined values
        const config: Record<string, any> = {
            encoding,
            languageCode: 'en-US',
            model: 'latest_short',
            enableAutomaticPunctuation: true,
        };
        if (sampleRateHertz !== undefined) {
            config.sampleRateHertz = sampleRateHertz;
        }
        if (audioChannelCount !== undefined) {
            config.audioChannelCount = audioChannelCount;
        }

        const response = await fetch(
            `https://speech.googleapis.com/v1/speech:recognize`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audio: {
                        content: audioBuffer.toString('base64'),
                    },
                    config,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Speech-to-Text API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        const transcription = data.results
            ?.map((result: any) => result.alternatives?.[0]?.transcript || '')
            .join(' ')
            .trim() || '';

        const confidence = data.results?.[0]?.alternatives?.[0]?.confidence || 0.9;

        console.log('[GoogleSpeechAdapter] REST Transcribed:', transcription.substring(0, 50) + '...');

        return {
            text: transcription,
            confidence,
            segments: [],
        };
    }
}
