export interface TTSChunk {
    text: string;
    index: number;
    isLast: boolean;
}

export class TTSChunker {
    private minLength: number;

    constructor(minLength: number = 20) {
        this.minLength = minLength;
    }

    /**
     * Splits text into semantic chunks suitable for TTS streaming.
     */
    public chunkText(text: string): TTSChunk[] {
        if (!text) return [];

        // Simple splitting by sentence boundaries.
        // A robust implementation would use a proper NLP tokenizer, 
        // but regex is sufficient for MVP.
        // Look for periods, question marks, exclamations followed by space or end of string.
        // Regex to match sentence endings but ignore common abbreviations (Mr., Dr., etc.)
        // This is a simplified negative lookbehind equivalent logic
        const rawSentences = text
            .replace(/(?<!\w)(Mr|Ms|Mrs|Dr|St)\./g, '$1\u0000') // Protect abbreviations
            .match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g); // Split by punctuation

        if (!rawSentences) {
            return [{ text: text, index: 0, isLast: true }];
        }

        const chunks: string[] = [];
        let currentBuffer = '';

        // Restore abbreviations
        const sentences = rawSentences.map(s => s.replace(/\u0000/g, '.'));

        for (let i = 0; i < sentences.length; i++) {
            const trimmed = sentences[i].trim();
            if (!trimmed) continue;

            const isFirst = chunks.length === 0 && currentBuffer.length === 0;

            // LATENCY OPTIMIZATION:
            // Always flush the FIRST chunk immediately, even if short, to start audio ASAP.
            // Subsequent chunks follow the minLength buffer rule.
            if (isFirst) {
                chunks.push(trimmed);
                continue;
            }

            if (currentBuffer.length + trimmed.length < this.minLength) {
                // Determine spacer
                const spacer = currentBuffer ? ' ' : '';
                currentBuffer += spacer + trimmed;
            } else {
                if (currentBuffer) {
                    chunks.push(currentBuffer);
                }
                currentBuffer = trimmed;
            }
        }

        if (currentBuffer) {
            chunks.push(currentBuffer);
        }

        return chunks.map((c, i) => ({
            text: c,
            index: i,
            isLast: i === chunks.length - 1
        }));
    }
}
