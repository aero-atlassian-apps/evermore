import { describe, it, expect, vi, beforeEach } from 'vitest';
import AoTStorybookGenerator from '@/lib/infrastructure/adapters/biographer/AoTStorybookGenerator';
import { LLMPort } from '@/lib/core/application/ports/LLMPort';

describe('AoTStorybookGenerator', () => {
  let generator: AoTStorybookGenerator;
  let mockLLM: LLMPort;

  beforeEach(() => {
    mockLLM = {
      generateText: vi.fn(),
      generateJson: vi.fn(),
      analyzeImage: vi.fn(),
    };
    generator = new AoTStorybookGenerator(mockLLM);
  });

  const mockChildrensStory = 'Once upon a time, Arthur went to work.';
  const mockAdultChapter = 'Arthur, a young man of 18, started his job.';

  it('should decompose story into atoms', async () => {
    // Setup mocks for each parallel call in decomposeStory
    (mockLLM.generateJson as any).mockImplementation(async (prompt: string) => {
      if (prompt.includes('identify key moments')) {
        return { moments: [{ moment: 'Arthur walks', importance: 1 }] };
      }
      if (prompt.includes('extracting visual elements')) {
        return { visualElements: ['Factory'] };
      }
      if (prompt.includes("structuring a children's story")) {
        return { beats: [{ beat: 'Start', pageRange: '1-2' }] };
      }
      if (prompt.includes('extracting character details')) {
        return { character: { name: 'Arthur', age: '18' } };
      }
      return {};
    });

    const atoms = await generator.decomposeStory(
      mockChildrensStory,
      mockAdultChapter
    );

    expect(atoms.keyMoments).toHaveLength(1);
    expect(atoms.visualElements).toContain('Factory');
    expect(atoms.characterDetails.name).toBe('Arthur');
  });

  it('should synthesize scenes', async () => {
    (mockLLM.generateJson as any).mockResolvedValue({
      scenes: [{ pageNumber: 1, moment: 'Scene 1' }],
    });

    const atoms = {
      keyMoments: [],
      visualElements: [],
      narrativeBeats: [],
      characterDetails: {
        name: 'Arthur',
        age: '18',
        physicalDescription: '',
        clothingStyle: '',
        personalityTraits: '',
      },
    };

    const scenes = await generator.synthesizeScenes(atoms, mockChildrensStory);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].moment).toBe('Scene 1');
  });
});
