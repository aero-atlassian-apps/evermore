import { ChapterRepository } from '../../../core/domain/repositories/ChapterRepository';
import AoTStorybookGenerator from '../biographer/AoTStorybookGenerator';
import { LLMPort } from '../../../core/application/ports/LLMPort';
import { ImageGenerationPort, GeneratedImage } from '../../../core/application/ports/ImageGenerationPort';

/**
 * Enhanced Storybook Scene with generated image
 */
interface EnhancedScene {
  pageNumber: number;
  moment: string;
  imagePrompt: string;
  storyText: string;
  visualElements: string[];
  image?: GeneratedImage;
  layout: 'full-bleed' | 'left-image' | 'right-image' | 'top-image' | 'bottom-image';
}

/**
 * Complete Storybook Data Structure
 */
export interface StorybookData {
  id: string;
  chapterId: string;
  title: string;
  childrenStory: string;
  scenes: EnhancedScene[];
  atoms: any;
  metadata: {
    generatedAt: Date;
    characterName: string;
    timePeriod: string;
    totalPages: number;
    style: string;
  };
}

/**
 * World-Class Storybook Service
 * 
 * Orchestrates the complete storybook generation pipeline:
 * 1. Load chapter content
 * 2. Transform into children's story (LLM)
 * 3. Decompose story into visual atoms (AoT)
 * 4. Synthesize optimal scene sequence
 * 5. Generate illustrations for each scene
 * 6. Apply context-aware layout decisions
 */
export class StorybookService {
  constructor(
    private chapterRepository: ChapterRepository,
    private llm: LLMPort,
    private imageGenerator?: ImageGenerationPort
  ) { }

  async generateStorybook(chapterId: string): Promise<StorybookData> {
    console.log(`📚 Starting world-class storybook generation for chapter: ${chapterId}`);

    // 1. Load Chapter
    const chapter = await this.chapterRepository.findById(chapterId);
    if (!chapter) throw new Error('Chapter not found');

    // 1b. Check if storybook already exists in metadata to avoid re-generation
    if (chapter.metadata?.storybook) {
      console.log(`   ├─ Found existing storybook in metadata, returning cached version`);
      return chapter.metadata.storybook as unknown as StorybookData;
    }

    console.log(`   ├─ Chapter loaded: "${chapter.title}" (${chapter.content.length} chars)`);

    // 2. Transform to Children's Story with context awareness
    const childrensStory = await this.transformToChildrenStory(chapter.content, chapter.title);
    console.log(`   ├─ Children's story created (${childrensStory.length} chars)`);

    // 3. Decompose using AoT (Atom of Thought)
    const generator = new AoTStorybookGenerator(this.llm);
    let { scenes: rawScenes, atoms } = await generator.generateStorybookScenes(childrensStory, chapter.content);
    console.log(`   ├─ AoT decomposition complete: ${rawScenes.length} scenes, ${atoms.keyMoments?.length || 0} key moments`);

    // 3b. FALLBACK: Generate scenes from children's story if AoT failed
    if (rawScenes.length === 0) {
      console.log('   ├─ ⚠️ AoT returned 0 scenes, using fallback scene generation...');
      rawScenes = this.generateFallbackScenes(childrensStory, chapter.title);
      atoms = {
        keyMoments: rawScenes.map(s => ({ moment: s.moment, importance: 0.7, reasoning: 'fallback' })),
        visualElements: ['warm family setting', 'vintage style', 'nostalgic colors'],
        narrativeBeats: [{ beat: chapter.title, pageRange: '1-6', purpose: 'story' }],
        characterDetails: { name: 'Our Hero', age: 'varies', physicalDescription: '', clothingStyle: 'era-appropriate', personalityTraits: 'warm' },
        emotionalTone: { primaryEmotion: 'warmth', emotionalArc: 'gentle nostalgia', preservationNotes: ['maintain warm, family-friendly tone'] }
      };
    }

    // 4. Determine optimal layout for each scene
    const scenesWithLayout = await this.applyContextAwareLayouts(rawScenes, atoms);
    console.log(`   ├─ Layout optimization applied`);

    // 5. Generate illustrations
    const scenesWithImages = await this.generateSceneImages(scenesWithLayout);
    console.log(`   ├─ Illustrations generated: ${scenesWithImages.filter(s => s.image).length}/${scenesWithImages.length}`);

    // 6. Compile final storybook data
    const storybook: StorybookData = {
      id: `storybook-${chapterId}-${Date.now()}`,
      chapterId,
      title: this.generateStorybookTitle(atoms.characterDetails?.name, chapter.title),
      childrenStory: childrensStory,
      scenes: scenesWithImages,
      atoms,
      metadata: {
        generatedAt: new Date(),
        characterName: atoms.characterDetails?.name || 'Our Hero',
        timePeriod: atoms.narrativeBeats?.[0]?.beat?.match(/\d{4}s?/)?.[0] || 'Long ago',
        totalPages: scenesWithImages.length + 2, // +2 for cover and closing
        style: 'watercolor-storybook',
      },
    };

    console.log(`   └─ ✨ Storybook complete! "${storybook.title}" (${storybook.metadata.totalPages} pages)`);

    return storybook;
  }

  /**
   * Transform adult chapter into engaging children's story
   * Uses context-aware prompting for appropriate tone and content
   */
  private async transformToChildrenStory(content: string, title: string): Promise<string> {
    const prompt = `You are a master children's book author transforming a real life story into a magical tale.

ORIGINAL STORY TITLE: ${title}

ORIGINAL CONTENT:
${content}

YOUR TASK:
Transform this into a warm, engaging children's story (ages 5-10) following these rules:

CONTENT TRANSFORMATION:
1. Keep the core narrative arc and emotional journey
2. Transform any difficult themes into age-appropriate lessons:
   - War → "A time when brave people helped each other"
   - Death → "Saying goodbye" or characters "going on a long journey"
   - Poverty → "Having little but sharing much"
   - Hardship → "Facing challenges with courage"
3. Add sensory details children can relate to (colors, sounds, feelings)
4. Include a gentle moral or life lesson
5. NO PLACEHOLDERS: If names are not known, use natural generic terms like "little one", "my dear", or "grandchild". NEVER use brackets like [Name] or [Grandchild].

STRUCTURE (6 pages):
- Page 1-2: Opening - Introduce the character and setting
- Page 3-4: Challenge - Something happens that needs courage/kindness
- Page 5: Resolution - How the character grows or helps others
- Page 6: Warm closing - A hopeful ending with connection to family

STYLE:
- Use "Once upon a time" or similar classic opening
- Simple vocabulary suitable for reading aloud
- Short, rhythmic sentences that flow well
- Include dialogue to make characters alive
- End with warmth and connection

LENGTH: 400-600 words total (approximately 70-100 words per page)

OUTPUT: Write the complete children's story, marking page breaks with "---PAGE X---"`;

    try {
      return await this.llm.generateText(prompt);
    } catch (error) {
      console.error('Children story transformation failed:', error);
      return this.fallbackChildrenStory(content, title);
    }
  }

  /**
   * Apply context-aware layouts based on scene content and narrative position
   */
  private async applyContextAwareLayouts(scenes: any[], atoms: any): Promise<EnhancedScene[]> {
    const layoutPrompt = `You are designing the visual layout for a 6-page illustrated children's book.

SCENES:
${scenes.map((s, i) => `Page ${s.pageNumber}: "${s.moment}" - ${s.storyText?.substring(0, 50)}...`).join('\n')}

CHARACTER: ${atoms.characterDetails?.name || 'Our Hero'}
KEY VISUAL ELEMENTS: ${atoms.visualElements?.join(', ') || 'warm scenes'}

TASK: For each page, recommend the best layout based on:
1. Narrative importance (climax gets full-bleed)
2. Text length (longer text = smaller image)
3. Visual variety (alternate layouts for flow)
4. Emotional weight (emotional moments = larger images)

LAYOUT OPTIONS:
- "full-bleed": Image fills entire page, text overlaid (for dramatic moments)
- "top-image": Image on top half, text below (traditional layout)
- "bottom-image": Text on top, image below (for dialogue-heavy pages)
- "left-image": Image on left, text on right (for character introductions)
- "right-image": Text on left, image on right (for action sequences)

OUTPUT FORMAT (JSON):
{
  "layouts": [
    { "pageNumber": 1, "layout": "full-bleed", "reason": "Opening scene needs impact" },
    ...
  ]
}`;

    try {
      const layoutDecisions = await this.llm.generateJson<{ layouts: Array<{ pageNumber: number; layout: string; reason: string }> }>(layoutPrompt);

      return scenes.map((scene, index) => {
        const layoutDecision = layoutDecisions.layouts?.find(l => l.pageNumber === scene.pageNumber);
        return {
          pageNumber: scene.pageNumber,
          moment: scene.moment,
          imagePrompt: scene.imagePrompt,
          storyText: scene.storyText || '',
          visualElements: scene.visualElements || [],
          layout: (layoutDecision?.layout || this.defaultLayout(index, scenes.length)) as EnhancedScene['layout'],
        };
      });
    } catch (error) {
      console.error('Layout generation failed, using defaults:', error);
      return scenes.map((scene, index) => ({
        pageNumber: scene.pageNumber,
        moment: scene.moment,
        imagePrompt: scene.imagePrompt,
        storyText: scene.storyText || '',
        visualElements: scene.visualElements || [],
        layout: this.defaultLayout(index, scenes.length),
      }));
    }
  }

  /**
   * Default layout pattern for visual variety
   */
  private defaultLayout(index: number, total: number): EnhancedScene['layout'] {
    if (index === 0) return 'full-bleed'; // Opening
    if (index === total - 1) return 'full-bleed'; // Closing
    if (index === Math.floor(total / 2)) return 'full-bleed'; // Climax
    const patterns: EnhancedScene['layout'][] = ['top-image', 'right-image', 'left-image', 'bottom-image'];
    return patterns[index % patterns.length];
  }

  /**
   * Generate images for all scenes using the image generation port
   */
  private async generateSceneImages(scenes: EnhancedScene[]): Promise<EnhancedScene[]> {
    if (!this.imageGenerator) {
      console.log('   │  ⚠️ No image generator configured, using placeholders');
      return scenes.map(scene => ({
        ...scene,
        image: this.createPlaceholderImage(scene),
      }));
    }

    const isAvailable = await this.imageGenerator.isAvailable();
    if (!isAvailable) {
      console.log('   │  ⚠️ Image generator not available, using placeholders');
      return scenes.map(scene => ({
        ...scene,
        image: this.createPlaceholderImage(scene),
      }));
    }

    const scenesForGeneration = scenes.map(s => ({
      pageNumber: s.pageNumber,
      imagePrompt: s.imagePrompt,
    }));

    try {
      const generatedImages = await this.imageGenerator.generateStorybookImages(scenesForGeneration, {
        style: 'watercolor',
        safetyLevel: 'strict',
      });

      return scenes.map(scene => ({
        ...scene,
        image: generatedImages.get(scene.pageNumber) || this.createPlaceholderImage(scene),
      }));
    } catch (error) {
      console.error('Image generation failed:', error);
      return scenes.map(scene => ({
        ...scene,
        image: this.createPlaceholderImage(scene),
      }));
    }
  }

  /**
   * Create a beautiful placeholder image when generation is unavailable
   */
  private createPlaceholderImage(scene: EnhancedScene): GeneratedImage {
    const shortMoment = scene.moment.substring(0, 40);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
            <defs>
                <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#87CEEB"/>
                    <stop offset="100%" style="stop-color:#FFF5E6"/>
                </linearGradient>
            </defs>
            <rect width="800" height="600" fill="url(#sky)"/>
            <ellipse cx="400" cy="650" rx="500" ry="200" fill="#98D977"/>
            <circle cx="650" cy="100" r="50" fill="#FFE4B5" opacity="0.8"/>
            <text x="400" y="280" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#5D4E37">
                🎨 Page ${scene.pageNumber}
            </text>
            <text x="400" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#7D6E57" font-style="italic">
                "${shortMoment}..."
            </text>
        </svg>`;

    return {
      base64: Buffer.from(svg).toString('base64'),
      mimeType: 'image/svg+xml',
      prompt: scene.imagePrompt,
      metadata: { model: 'placeholder' },
    };
  }

  /**
   * Generate an engaging storybook title
   */
  private generateStorybookTitle(characterName: string | undefined, chapterTitle: string): string {
    if (characterName) {
      return `The Story of ${characterName}`;
    }
    // Extract key theme from chapter title
    return chapterTitle.length > 30
      ? `A Special Story`
      : chapterTitle;
  }

  /**
   * Fallback children's story when LLM fails
   */
  private fallbackChildrenStory(content: string, title: string): string {
    const cleanContent = content.substring(0, 300).replace(/[.!?]+/g, '. ');
    return `---PAGE 1---
Once upon a time, there was someone very special with a wonderful story to share.

---PAGE 2---
${cleanContent}

---PAGE 3---
And through all the years, they learned that the most important things in life are the people we love.

---PAGE 4---
They showed kindness to everyone they met, and in return, they found friends wherever they went.

---PAGE 5---
Even when things were hard, they never gave up. They knew that tomorrow would bring new adventures.

---PAGE 6---
And so, surrounded by love and memories, they lived happily, knowing their story would be told for generations to come.

The End.`;
  }

  /**
   * Generate fallback scenes when AoT fails (e.g., credentials issues)
   * Parses the children's story by ---PAGE X--- markers
   */
  private generateFallbackScenes(childrensStory: string, title: string): any[] {
    const pages = childrensStory.split(/---PAGE\s*\d+---/i).filter(p => p.trim());

    // If no page markers, split by paragraphs
    const segments = pages.length > 1 ? pages : childrensStory.split('\n\n').filter(p => p.trim());

    // Create 6 scenes (or as many as we have segments, max 6)
    const sceneCount = Math.min(Math.max(segments.length, 3), 6);
    const scenes: any[] = [];

    for (let i = 0; i < sceneCount; i++) {
      const text = segments[i] || segments[segments.length - 1] || 'A moment from the story...';
      const moment = text.substring(0, 50).replace(/[^\w\s]/g, '').trim();

      scenes.push({
        pageNumber: i + 1,
        moment: moment || `Page ${i + 1}`,
        imagePrompt: `Warm watercolor children's book illustration. ${moment}. Nostalgic, family-friendly, soft colors. No text, no speech bubbles.`,
        storyText: text.trim(),
        visualElements: ['warm tones', 'nostalgic setting', 'family-friendly']
      });
    }

    console.log(`   ├─ Fallback generated ${scenes.length} scenes from children's story`);
    return scenes;
  }
}
