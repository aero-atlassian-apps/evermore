
export interface ImageAnalysisRequest {
    image: Buffer;
    mimeType: string;
    prompt?: string; // Optional guiding question (e.g., "What medication is this?")
    intent: 'GENERAL_DESC' | 'OBJECT_DETECTION' | 'TEXT_READING' | 'SAFETY_CHECK';
}

export interface DetectedObject {
    label: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface ImageAnalysisResult {
    description: string;
    objects?: DetectedObject[];
    containsText?: string;
    safetyFlag: boolean;
    safetyReason?: string;
}

export interface ImageGenerationRequest {
    prompt: string;
    negativePrompt?: string;
    style?: 'realistic' | 'illustration' | 'sketch' | 'painting';
    size?: '256x256' | '512x512' | '1024x1024';
    count?: number;
}

export interface ImageGenerationResult {
    images: Buffer[];
    seed: number;
    promptUsed: string; // Including any auto-augmentations
}

export interface ImagePort {
    analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult>;
    generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
