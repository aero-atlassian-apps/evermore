export interface ChapterGeneratorResult {
  chapter: string;
  atoms: {
    narrativeArc: string;
    emotionalValence: string;
    [key: string]: any;
  };
}

export interface ChapterGenerationContext {
  userSeed?: {
    name: string;
    age?: string;
    gender?: string;
    bio?: string;
  };
  knownThemes?: string[];
  cumulativeEmotionalState?: string;
  memories?: string[];
  isDayZero: boolean;
}

export interface ChapterGeneratorPort {
  generateChapter(transcript: string, previousContext: any[], context?: ChapterGenerationContext): Promise<ChapterGeneratorResult>;
}
