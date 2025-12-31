export interface StorybookAtoms {
    keyMoments: Array<{ moment: string; importance: number; reasoning: string }>;
    visualElements: string[];
    narrativeBeats: Array<{ beat: string; pageRange: string; purpose: string }>;
    characterDetails: { name: string; age: string; physicalDescription: string; clothingStyle?: string; personalityTraits?: string };
    emotionalTone?: {
        primaryEmotion: string;
        emotionalArc: string;
        preservationNotes: string[];
    };
    setting?: {
        timePeriod: string;
        location: string;
        atmosphere: string;
    };
    emotionalArc?: string; // Legacy support for transition
}

export interface StorybookData {
    id: string;
    chapterId: string;
    title: string;
    childrenStory: string;
    scenes: any[]; // Using any[] to avoid circular deps with Scene types for now, or define Scene here too
    atoms: any;
    metadata: {
        generatedAt: Date;
        characterName: string;
        timePeriod: string;
        totalPages: number;
        style: string;
    };
}

export interface StorybookContext {
    characterName?: string;
    characterDescription?: string;
    visualThemes?: string[];
    timePeriod?: string;
}

export interface StorybookGeneratorPort {
    generateStorybook(chapterId: string, context?: StorybookContext): Promise<StorybookData>;
}
