/**
 * Speech Normalizer Service
 *
 * Normalizes speech text by removing fillers, hesitations, and noise artifacts.
 */

export function normalizeSpeech(text: string): string {
    if (!text) return '';

    // Common filler words
    const fillers = [
        /\b(um|uh|er|ah|like|you know|so yeah|basically|literally|actually|i mean|right)\b/gi,
        /\b(hmm|mhmm|uh-huh)\b/gi,
        /\b(sort of|kind of)\b/gi
    ];

    let normalized = text;

    // Remove fillers
    fillers.forEach(pattern => {
        normalized = normalized.replace(pattern, '');
    });

    // Remove repeated words (stuttering) like "I I", "the the"
    // Case insensitive, single word repetition
    normalized = normalized.replace(/\b(\w+)\s+\1\b/gi, '$1');

    // Fix punctuation and spacing
    normalized = normalized
        .replace(/\s+,/g, ',')      // "word ," -> "word,"
        .replace(/,(\s*,)+/g, ',')  // ", ," -> ","
        .replace(/\s+/g, ' ')       // "  " -> " "
        .trim();

    // Capitalize first letter
    if (normalized.length > 0) {
        normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    return normalized;
}
