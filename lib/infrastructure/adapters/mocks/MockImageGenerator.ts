/**
 * Mock Image Generator for Development/Testing
 * 
 * Generates placeholder images without making API calls.
 * Useful for local development and unit testing.
 */

import {
    ImageGenerationPort,
    ImageGenerationOptions,
    GeneratedImage
} from '../../../core/application/ports/ImageGenerationPort';

export class MockImageGenerator implements ImageGenerationPort {
    private generateCount = 0;

    async isAvailable(): Promise<boolean> {
        return true; // Mock is always available
    }

    async generateImage(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage> {
        this.generateCount++;

        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));

        return this.createMockImage(prompt, options);
    }

    async generateStorybookImages(
        scenes: Array<{ pageNumber: number; imagePrompt: string }>,
        options?: ImageGenerationOptions
    ): Promise<Map<number, GeneratedImage>> {
        const results = new Map<number, GeneratedImage>();

        for (const scene of scenes) {
            const image = await this.generateImage(scene.imagePrompt, options);
            results.set(scene.pageNumber, image);
        }

        return results;
    }

    private createMockImage(prompt: string, options?: ImageGenerationOptions): GeneratedImage {
        const width = options?.width || 600;
        const height = options?.height || 400;
        const shortPrompt = prompt.substring(0, 60).replace(/[<>&"']/g, '');

        // Generate colorful gradient based on prompt hash
        const hash = this.hashString(prompt);
        const hue1 = hash % 360;
        const hue2 = (hash * 2) % 360;

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <defs>
                <linearGradient id="grad${this.generateCount}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:hsl(${hue1}, 40%, 90%)"/>
                    <stop offset="100%" style="stop-color:hsl(${hue2}, 50%, 85%)"/>
                </linearGradient>
                <pattern id="dots${this.generateCount}" patternUnits="userSpaceOnUse" width="20" height="20">
                    <circle cx="10" cy="10" r="2" fill="rgba(255,255,255,0.3)"/>
                </pattern>
            </defs>
            <rect width="${width}" height="${height}" fill="url(#grad${this.generateCount})"/>
            <rect width="${width}" height="${height}" fill="url(#dots${this.generateCount})"/>
            <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="rgba(255,255,255,0.8)" rx="20"/>
            <text x="${width / 2}" y="${height / 2 - 30}" text-anchor="middle" font-family="Georgia, serif" font-size="32" fill="#8B6914">
                📖 Page ${this.generateCount}
            </text>
            <text x="${width / 2}" y="${height / 2 + 10}" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#A08060" font-style="italic">
                "${shortPrompt}..."
            </text>
            <text x="${width / 2}" y="${height / 2 + 40}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#C0A080">
                [Mock Storybook Illustration]
            </text>
        </svg>`;

        const base64 = Buffer.from(svg).toString('base64');

        return {
            base64,
            mimeType: 'image/svg+xml',
            prompt,
            metadata: {
                model: 'mock-generator',
                seed: hash,
            },
        };
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // For testing
    getGenerateCount(): number {
        return this.generateCount;
    }

    reset(): void {
        this.generateCount = 0;
    }
}
