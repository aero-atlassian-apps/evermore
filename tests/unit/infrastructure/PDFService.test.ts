import { describe, it, expect, vi } from 'vitest';
import { PDFService } from '../../../lib/infrastructure/adapters/biographer/PDFService';

describe('PDFService', () => {
    it('should generate a PDF buffer', async () => {
        const service = new PDFService();
        const chapters = [
            { title: 'Chapter 1', content: 'This is the content of chapter 1.' }
        ];
        const photos: any[] = [];

        const buffer = await service.generateBook(chapters, photos);

        expect(buffer).toBeInstanceOf(Buffer);
        // Basic check for PDF header
        const header = buffer.subarray(0, 5).toString();
        expect(header).toBe('%PDF-');
    });
});
