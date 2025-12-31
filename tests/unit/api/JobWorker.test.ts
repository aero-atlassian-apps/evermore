import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Define mocks inside the module mock to avoid hoisting issues
vi.mock("@/lib/infrastructure/di/container", () => {
  const mockJobRepository = {
    findPending: vi.fn(),
    updateStatus: vi.fn(),
  };
  const mockGenerateChapterUseCase = {
    execute: vi.fn(),
  };
  return {
    jobRepository: mockJobRepository,
    generateChapterUseCase: mockGenerateChapterUseCase,
  };
});

// Import after mock
import { GET } from "@/app/api/cron/process-jobs/route";
import { jobRepository, generateChapterUseCase } from "@/lib/infrastructure/di/container";

describe("API Job Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret";
  });

  it("should return 401 if unauthorized", async () => {
    const req = new NextRequest("http://localhost/api/cron/process-jobs");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("should process pending jobs", async () => {
    const req = new NextRequest("http://localhost/api/cron/process-jobs", {
      headers: { authorization: "Bearer secret" },
    });

    // Mock pending jobs - use imported mock object
    (jobRepository.findPending as any).mockResolvedValue([
      { id: "job-1", payload: { sessionId: "sess-1" } },
    ]);

    // Mock successful execution
    (generateChapterUseCase.execute as any).mockResolvedValue("chapter-1");

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(jobRepository.updateStatus).toHaveBeenCalledWith("job-1", "processing");
    expect(jobRepository.updateStatus).toHaveBeenCalledWith("job-1", "completed", { chapterId: "chapter-1" });
  });

  it("should handle job failure", async () => {
    const req = new NextRequest("http://localhost/api/cron/process-jobs", {
      headers: { authorization: "Bearer secret" },
    });

    (jobRepository.findPending as any).mockResolvedValue([
      { id: "job-1", payload: { sessionId: "sess-1" } },
    ]);

    (generateChapterUseCase.execute as any).mockRejectedValue(new Error("Generation failed"));

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(jobRepository.updateStatus).toHaveBeenCalledWith("job-1", "failed", undefined, "Generation failed");
  });
});
