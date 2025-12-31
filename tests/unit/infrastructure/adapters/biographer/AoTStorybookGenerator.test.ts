import { describe, it, expect, vi, beforeEach } from 'vitest';
import AoTStorybookGenerator from '../../../../../lib/infrastructure/adapters/biographer/AoTStorybookGenerator';
import { LLMPort } from '../../../../../lib/core/application/ports/LLMPort';

describe('AoTStorybookGenerator', () => {
    let generator: AoTStorybookGenerator;
    let mockLLM: LLMPort;

    beforeEach(() => {
        mockLLM = {
            generateText: vi.fn(),
            generateJson: vi.fn(),
            analyzeImage: vi.fn()
        };
        generator = new AoTStorybookGenerator(mockLLM);
    });

    it('should decompose story correctly (Atom 1-4)', async () => {
        // Mock responses for each atom
        vi.spyOn(mockLLM, 'generateJson').mockImplementation(async (prompt) => {
            if (prompt.includes("identify key moments")) {
                return { moments: [{ moment: "Moment 1", importance: 0.9 }] };
            }
            if (prompt.includes("extracting visual elements")) {
                return { visualElements: ["Element A", "Element B"] };
            }
            if (prompt.includes("narrative beats")) {
                return { beats: [{ beat: "Beat 1" }] };
            }
            if (prompt.includes("character details")) {
                return { character: { name: "TestChar" } };
            }
            return {};
        });

        const atoms = await generator.decomposeStory("Children story", "Adult chapter");

        expect(atoms.keyMoments).toHaveLength(1);
        expect(atoms.keyMoments[0].moment).toBe("Moment 1");
        expect(atoms.visualElements).toContain("Element A");
        expect(atoms.characterDetails.name).toBe("TestChar");
    });

    it('should synthesize scenes (Phase 2)', async () => {
        const atoms: any = {
            keyMoments: [], visualElements: [], narrativeBeats: [], characterDetails: { name: "Test" }
        };

        vi.spyOn(mockLLM, 'generateJson').mockResolvedValue({
            scenes: [
                { pageNumber: 1, moment: "Scene 1" },
                { pageNumber: 2, moment: "Scene 2" }
            ]
        });

        const scenes = await generator.synthesizeScenes(atoms, "Story text");

        expect(scenes).toHaveLength(2);
        expect(scenes[0].moment).toBe("Scene 1");
    });

    it('should handle LLM failures gracefully', async () => {
        vi.spyOn(mockLLM, 'generateJson').mockRejectedValue(new Error("LLM Error"));

        const result = await generator.identifyKeyMoments("text");
        expect(result).toEqual([]);
    });
});
