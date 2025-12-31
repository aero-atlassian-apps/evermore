import { describe, it, expect, vi, beforeEach } from "vitest";
import { AoTChapterGeneratorAdapter } from "@/lib/infrastructure/adapters/ai/AoTChapterGeneratorAdapter";
import { LLMPort } from "@/lib/core/application/ports/LLMPort";

describe("AoTChapterGeneratorAdapter", () => {
  let generator: AoTChapterGeneratorAdapter;
  let mockLLM: LLMPort;

  beforeEach(() => {
    mockLLM = {
      generateText: vi.fn(),
      generateJson: vi.fn(),
      analyzeImage: vi.fn(),
    };
    generator = new AoTChapterGeneratorAdapter(mockLLM);
  });

  const mockTranscript = `
    Speaker A: I remember the summer of 69. We were young and restless.
    Speaker B: Tell me more about that.
    Speaker A: We drove to the coast in an old Chevy. The smell of salt and gasoline.
    It was the best time of my life.
  `;

  it("should decompose transcript into atoms", async () => {
    // Mock successful LLM responses for each atom
    (mockLLM.generateText as any).mockResolvedValue("A summer road trip in 1969.");
    (mockLLM.generateJson as any).mockImplementation(async (prompt: string) => {
      if (prompt.includes("best quotes")) return { quotes: [{ text: "We were young", reason: "Youth" }] };
      if (prompt.includes("sensory details")) return { sensoryDetails: [{ phrase: "smell of salt", sense: "smell" }] };
      if (prompt.includes("emotional valence")) return { emotion: "nostalgia", confidence: 0.9 };
      if (prompt.includes("connections")) return { connections: [] };
      return {};
    });

    const atoms = await generator.decomposeTranscript(mockTranscript, []);

    expect(atoms.narrativeArc).toBe("A summer road trip in 1969.");
    expect(atoms.emotionalValence).toBe("nostalgia");
    expect(atoms.bestQuotes).toHaveLength(1);
  });

  it("should synthesize chapter from atoms", async () => {
    const mockAtoms = {
      narrativeArc: "A summer road trip",
      bestQuotes: [],
      sensoryDetails: [],
      emotionalValence: "joy",
      previousChapterConnections: []
    };

    (mockLLM.generateText as any).mockResolvedValue("# Chapter 1\n\nIt was a sunny day...");

    const chapter = await generator.synthesizeChapter(mockAtoms, mockTranscript);
    expect(chapter).toContain("# Chapter 1");
  });

  it("should handle LLM failures gracefully in decomposition", async () => {
    // Mock failure for narrative arc
    (mockLLM.generateText as any).mockRejectedValue(new Error("API Error"));

    // Mock success for others to ensure partial failure handling
    (mockLLM.generateJson as any).mockResolvedValue({});

    const atoms = await generator.decomposeTranscript(mockTranscript, []);

    // Narrative arc should have fallback
    expect(atoms.narrativeArc).toBeDefined();
    expect(atoms.narrativeArc).toBe('Memory'); // Implementation fallback
  });
});
