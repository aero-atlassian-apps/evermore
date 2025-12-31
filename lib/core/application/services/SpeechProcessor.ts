import { SpeechToTextResult, SpeechSegment } from '../ports/SpeechPort';

export interface SpeechProcessorConfig {
    minConfidence: number; // Defaults to 0.6
    removeFillers: boolean; // Defaults to true
    formatSpeakers: boolean; // Defaults to true
}

export class SpeechProcessor {
    private config: SpeechProcessorConfig;

    constructor(config: Partial<SpeechProcessorConfig> = {}) {
        this.config = {
            minConfidence: 0.6,
            removeFillers: true,
            formatSpeakers: true,
            ...config
        };
    }

    /**
     * Processes raw speech result into clean, formatted text.
     */
    public processInput(result: SpeechToTextResult): string {
        // If no segments, fallback to full text
        if (!result.segments || result.segments.length === 0) {
            return this.cleanText(result.text, result.confidence);
        }

        // Process per segment
        const formattedSegments = result.segments.map(seg => {
            const cleanContent = this.cleanText(seg.text, seg.confidence);

            if (this.config.formatSpeakers) {
                return `[${seg.speakerId}]: ${cleanContent}`;
            }
            return cleanContent;
        });

        return formattedSegments.join('\n');
    }

    /**
     * Cleans individual text blocks based on confidence and fillers.
     */
    private cleanText(text: string, confidence: number): string {
        if (confidence < this.config.minConfidence) {
            return '[UNINTELLIGIBLE]';
        }

        let cleaned = text;

        if (this.config.removeFillers) {
            cleaned = cleaned
                .replace(/\b(um|uh|er|ah|like|you know|so yeah)\b/gi, '')
                .replace(/\s+,/g, ',')
                .replace(/,(\s*,)+/g, ',')
                .replace(/^,\s*/, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        return cleaned;
    }
}
