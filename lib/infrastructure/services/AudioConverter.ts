/**
 * AudioConverter - Server-side audio format conversion
 * 
 * Converts browser-recorded WebM/Opus audio to WAV format for universal
 * compatibility with speech-to-text APIs (HuggingFace, Google Cloud, OpenAI, ElevenLabs).
 * 
 * Uses ffmpeg for high-quality audio transcoding.
 * 
 * Production-ready: Works in Docker containers with ffmpeg installed.
 */

import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';

export interface AudioConversionResult {
    buffer: Buffer;
    format: string;
    sampleRate: number;
    channels: number;
    durationMs?: number;
}

export interface AudioConversionOptions {
    targetFormat?: 'wav' | 'flac' | 'mp3';
    sampleRate?: number;
    channels?: number;
}

const DEFAULT_OPTIONS: Required<AudioConversionOptions> = {
    targetFormat: 'wav',
    sampleRate: 16000,  // 16kHz is optimal for speech recognition
    channels: 1         // Mono for speech
};

/**
 * AudioConverter service for transcoding audio formats
 * 
 * IMPORTANT: Requires FFmpeg to be installed in the environment.
 * Docker: apk add --no-cache ffmpeg (Alpine) or apt-get install ffmpeg (Debian)
 */
export class AudioConverter {
    private ffmpegPath: string;

    constructor(ffmpegPath: string = 'ffmpeg') {
        this.ffmpegPath = ffmpegPath;
    }

    /**
     * Check if FFmpeg is available
     */
    async isAvailable(): Promise<boolean> {
        return new Promise((resolve) => {
            const proc = spawn(this.ffmpegPath, ['-version']);
            proc.on('error', () => resolve(false));
            proc.on('close', (code) => resolve(code === 0));
        });
    }

    /**
     * Convert audio buffer to target format
     * 
     * @param inputBuffer - Input audio buffer (e.g., WebM/Opus from browser)
     * @param inputFormat - Input MIME type (e.g., 'audio/webm;codecs=opus')
     * @param options - Conversion options
     * @returns Converted audio buffer with metadata
     */
    async convert(
        inputBuffer: Buffer,
        inputFormat: string,
        options: AudioConversionOptions = {}
    ): Promise<AudioConversionResult> {
        const opts = { ...DEFAULT_OPTIONS, ...options };

        // Determine input format for ffmpeg
        const inputExt = this.mimeToExtension(inputFormat);

        return new Promise((resolve, reject) => {
            const outputChunks: Buffer[] = [];

            // FFmpeg args for audio conversion
            // Force input format when known to prevent misdetection (e.g., WebM as MP3)
            // Add probesize for unknown formats
            const args: string[] = [];

            // Force input format for known types to prevent misdetection
            if (inputFormat.includes('webm')) {
                args.push('-f', 'webm');
            } else if (inputFormat.includes('ogg')) {
                args.push('-f', 'ogg');
            } else {
                // For unknown formats, increase probe size
                args.push('-probesize', '50M', '-analyzeduration', '10M');
            }

            args.push(
                '-i', 'pipe:0',              // Read from stdin
                '-vn',                       // No video (skip any video streams)
                '-f', opts.targetFormat,     // Output format
                '-ar', opts.sampleRate.toString(),
                '-ac', opts.channels.toString(),
            );

            // Add codec based on output format
            if (opts.targetFormat === 'wav') {
                args.push('-acodec', 'pcm_s16le');
            } else if (opts.targetFormat === 'flac') {
                args.push('-acodec', 'flac');
            } else if (opts.targetFormat === 'mp3') {
                args.push('-acodec', 'libmp3lame', '-q:a', '2');
            }

            args.push('pipe:1'); // Output to stdout

            const proc = spawn(this.ffmpegPath, args);
            let stderr = '';

            proc.stdout.on('data', (chunk: Buffer) => {
                outputChunks.push(chunk);
            });

            proc.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('error', (err) => {
                console.error('[AudioConverter] FFmpeg spawn error:', err.message);
                reject(new Error(`FFmpeg not available: ${err.message}`));
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    console.error('[AudioConverter] FFmpeg conversion failed:', stderr);
                    reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
                    return;
                }

                const outputBuffer = Buffer.concat(outputChunks);
                console.log(`[AudioConverter] Converted ${inputBuffer.length} bytes (${inputFormat}) → ${outputBuffer.length} bytes (${opts.targetFormat})`);

                resolve({
                    buffer: outputBuffer,
                    format: `audio/${opts.targetFormat}`,
                    sampleRate: opts.sampleRate,
                    channels: opts.channels
                });
            });

            // Write input buffer to ffmpeg stdin
            proc.stdin.write(inputBuffer);
            proc.stdin.end();
        });
    }

    /**
     * Convert MIME type to file extension for ffmpeg
     */
    private mimeToExtension(mimeType: string): string {
        const normalized = mimeType.toLowerCase().replace(/\s+/g, '');

        // Common browser audio formats
        if (normalized.includes('webm')) return 'webm';
        if (normalized.includes('ogg')) return 'ogg';
        if (normalized.includes('mp3') || normalized.includes('mpeg')) return 'mp3';
        if (normalized.includes('wav') || normalized.includes('wave')) return 'wav';
        if (normalized.includes('flac')) return 'flac';
        if (normalized.includes('m4a') || normalized.includes('mp4')) return 'm4a';
        if (normalized.includes('aac')) return 'aac';

        // Default to webm (common browser MediaRecorder format)
        console.warn(`[AudioConverter] Unknown MIME type: ${mimeType}, defaulting to webm`);
        return 'webm';
    }

    /**
     * Get the appropriate Content-Type header for the target format
     */
    getContentType(format: 'wav' | 'flac' | 'mp3'): string {
        switch (format) {
            case 'wav': return 'audio/wav';
            case 'flac': return 'audio/flac';
            case 'mp3': return 'audio/mpeg';
            default: return 'audio/wav';
        }
    }
}

// Singleton instance for convenience
let audioConverterInstance: AudioConverter | null = null;

export function getAudioConverter(): AudioConverter {
    if (!audioConverterInstance) {
        audioConverterInstance = new AudioConverter();
    }
    return audioConverterInstance;
}
