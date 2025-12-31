import { describe, it, expect } from 'vitest';
import { Chapter } from '@/lib/core/domain/entities/Chapter';

describe('Chapter Entity', () => {
  it('should create a Chapter instance correctly', () => {
    const chapter = new Chapter(
      'chapter-1',
      'session-1',
      'user-1',
      'My Story',
      'Once upon a time...',
      'Once upon...',
      new Date()
    );

    expect(chapter).toBeInstanceOf(Chapter);
    expect(chapter.title).toBe('My Story');
    expect(chapter.content).toBe('Once upon a time...');
  });

  it('should handle metadata and entities', () => {
    const chapter = new Chapter(
      'chapter-2',
      'session-2',
      'user-1',
      'My Story 2',
      'Content',
      'Excerpt',
      new Date(),
      undefined,
      undefined,
      undefined,
      [{ type: 'person', name: 'Alice', mentions: 2 }],
      { sessionNumber: 1, wordCount: 100, emotionalTone: 'happy' }
    );

    expect(chapter.entities).toHaveLength(1);
    expect(chapter.entities?.[0].name).toBe('Alice');
    expect(chapter.metadata?.wordCount).toBe(100);
  });
});
