import { ChapterRepository } from '../../domain/repositories/ChapterRepository';
import { PDFPort } from '../ports/PDFPort';

export class ExportBookUseCase {
    constructor(
        private chapterRepository: ChapterRepository,
        private pdfService: PDFPort
    ) { }

    async execute(userId: string): Promise<Buffer> {
        const chapters = await this.chapterRepository.findByUserId(userId);

        // CHECK: Do we have storybook data?
        // For MVP, if we have at least one storybook-enriched chapter, we try to make it special.
        // Currently PDFService supports 'generateIllustratedStorybook' for a SINGLE storybook.
        // We will need to enhance PDFService to support a full BOOK of storybooks later.
        // For now, if there is only 1 chapter and it has a storybook, use that.

        if (chapters.length === 1 && (chapters[0].metadata as any)?.storybook) {
            const storybookData = (chapters[0].metadata as any).storybook;
            // We need to cast or access the method if it exists on the interface? 
            // PDFPort interface might need update, or we cast to known implementation for this MVP fix.
            // Ideally update Port, but for now let's see if we can use the method.
            // The implementation has 'generateIllustratedStorybook'.

            // Cast to any to access the specialized method not yet on the Port interface
            if ((this.pdfService as any).generateIllustratedStorybook) {
                return (this.pdfService as any).generateIllustratedStorybook(storybookData);
            }
        }

        // Default / Multi-chapter text fallback
        const bookContent = chapters.map(ch => ({
            title: ch.title,
            content: ch.content
        }));

        const photos: string[] = [];

        return this.pdfService.generateBook(bookContent, photos);
    }
}
