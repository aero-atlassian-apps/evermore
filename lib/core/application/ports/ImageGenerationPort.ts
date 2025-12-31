/**
 * Image Generation Port - Contract for AI Image Generation
 * 
 * Abstracts the image generation provider (Google Imagen, DALL-E, etc.)
 */

export interface ImageGenerationOptions {
    /** Image width in pixels */
    width?: number;
    /** Image height in pixels */
    height?: number;
    /** Style preset (watercolor, cartoon, realistic, etc.) */
    style?: 'watercolor' | 'cartoon' | 'realistic' | 'storybook';
    /** Safety filter level */
    safetyLevel?: 'strict' | 'moderate';
    /** Number of images to generate */
    count?: number;
}

export interface GeneratedImage {
    /** Base64-encoded image data */
    base64: string;
    /** MIME type (image/png, image/jpeg) */
    mimeType: string;
    /** Prompt used to generate */
    prompt: string;
    /** Generation metadata */
    metadata?: {
        model?: string;
        seed?: number;
        revisedPrompt?: string;
    };
}

export interface ImageGenerationPort {
    /**
     * Generate an image from a text prompt
     */
    generateImage(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage>;

    /**
     * Generate multiple images for a storybook
     */
    generateStorybookImages(
        scenes: Array<{ pageNumber: number; imagePrompt: string }>,
        options?: ImageGenerationOptions
    ): Promise<Map<number, GeneratedImage>>;

    /**
     * Check if the service is available
     */
    isAvailable(): Promise<boolean>;
}
