/**
 * JSON Parsing Utilities
 * 
 * Robustly extracts JSON from potentially messy LLM outputs.
 */

export class JsonParser {
    /**
     * Parse JSON from a string that might contain markdown or other text.
     * 
     * @param text The text to parse
     * @returns Parsed object or throws error
     */
    static parse<T>(text: string): T {
        try {
            // 1. Try direct parse first (fast path)
            return JSON.parse(text);
        } catch (e) {
            // 2. Try to clean markdown code blocks
            // Matches ```json ... ``` or ``` ... ```
            const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
            const match = text.match(markdownRegex);

            if (match && match[1]) {
                try {
                    return JSON.parse(match[1]);
                } catch (e2) {
                    // fall through
                }
            }

            // 3. Try to find the first '{' and last '}'
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const candidate = text.substring(firstBrace, lastBrace + 1);
                try {
                    return JSON.parse(candidate);
                } catch (e3) {
                    // fall through
                }
            }

            // 4. Try to find the first '[' and last ']' (for arrays)
            const firstBracket = text.indexOf('[');
            const lastBracket = text.lastIndexOf(']');

            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                const candidate = text.substring(firstBracket, lastBracket + 1);
                try {
                    return JSON.parse(candidate);
                } catch (e4) {
                    throw new Error(`Failed to parse extracted JSON candidate: ${candidate.substring(0, 50)}...`);
                }
            }

            throw new Error(`Could not extract JSON from text: ${text.substring(0, 50)}...`);
        }
    }

    /**
     * Safe parse that returns null instead of throwing.
     */
    static safeParse<T>(text: string): T | null {
        try {
            return this.parse<T>(text);
        } catch (e) {
            return null;
        }
    }
}
