import { describe, it, expect } from 'vitest';
import { Storybook } from '@/lib/core/domain/entities/Storybook';
import { randomUUID } from 'crypto';

describe('Storybook Entity', () => {
    it('should create a Storybook instance correctly', () => {
        const id = randomUUID();
        const chapterId = randomUUID();
        const pages = [{ pageNumber: 1, text: 'Hello', imagePrompt: 'Hi' }];
        const storybook = new Storybook(
            id,
            chapterId,
            'My Story',
            pages,
            'http://pdf.url'
        );

        expect(storybook).toBeInstanceOf(Storybook);
        expect(storybook.id).toBe(id);
        expect(storybook.title).toBe('My Story');
        expect(storybook.pages).toHaveLength(1);
        expect(storybook.pdfUrl).toBe('http://pdf.url');
    });

    it('should set pdfUrl correctly', () => {
        const id = randomUUID();
        const chapterId = randomUUID();
        const pages = [{ pageNumber: 1, text: 'Hello' }];
        const storybook = new Storybook(
            id,
            chapterId,
            'My Story',
            pages,
            undefined
        );

        const updated = storybook.setPdfUrl('http://new.pdf');
        expect(updated.pdfUrl).toBe('http://new.pdf');
        expect(updated.id).toBe(storybook.id);
        expect(updated).not.toBe(storybook); // Immutable
    });
});
