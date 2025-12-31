import { StorybookData } from '../../../infrastructure/adapters/storybook/StorybookService';

export interface PDFPort {
    /**
     * Generate a simple book PDF from chapters (legacy)
     */
    generateBook(chapters: { title: string; content: string }[], photos: string[]): Promise<Buffer>;

    /**
     * Generate an illustrated storybook PDF with images and layouts
     */
    generateIllustratedStorybook(storybook: StorybookData): Promise<Buffer>;

    /**
     * Generate a PDF for a single chapter
     */
    generateChapterPdf(chapter: {
        id: string;
        title: string;
        content: string;
        excerpt?: string;
        createdAt: Date;
    }): Promise<Buffer>;
}

