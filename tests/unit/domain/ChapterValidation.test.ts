import { describe, it, expect } from "vitest";
import { Chapter } from "@/lib/core/domain/entities/Chapter";

describe("Chapter Entity", () => {
  const validChapterData = {
    id: "123",
    sessionId: "s-1",
    userId: "u-1",
    title: "My Life",
    content: "This is a valid chapter content that is long enough to pass validation rules.",
    excerpt: "This is...",
    createdAt: new Date(),
    metadata: { sessionNumber: 1, wordCount: 100, emotionalTone: "joy" }
  };

  it("should create a valid chapter", () => {
    const chapter = new Chapter(
      validChapterData.id,
      validChapterData.sessionId,
      validChapterData.userId,
      validChapterData.title,
      validChapterData.content,
      validChapterData.excerpt,
      validChapterData.createdAt,
      undefined,
      undefined,
      undefined,
      [],
      validChapterData.metadata
    );

    expect(() => chapter.validate()).not.toThrow();
  });

  it("should throw error if title is empty", () => {
    const chapter = new Chapter(
      "123",
      "s-1",
      "u-1",
      "", // Empty title
      "Content...",
      "Excerpt",
      new Date()
    );
    expect(() => chapter.validate()).toThrow("Chapter title cannot be empty");
  });

  it("should throw error if content is too short", () => {
    const chapter = new Chapter(
      "123",
      "s-1",
      "u-1",
      "Title",
      "Too short", // < 50 chars
      "Excerpt",
      new Date()
    );
    expect(() => chapter.validate()).toThrow("Chapter content is too short");
  });
});
