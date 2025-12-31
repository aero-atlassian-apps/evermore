import { jsPDF } from "jspdf";
import { PDFPort } from "../../../core/application/ports/PDFPort";
import { StorybookData } from "../storybook/StorybookService";

interface EnhancedScene {
    pageNumber: number;
    moment: string;
    imagePrompt: string;
    storyText: string;
    visualElements: string[];
    image?: {
        base64: string;
        mimeType: string;
        prompt: string;
    };
    layout: 'full-bleed' | 'left-image' | 'right-image' | 'top-image' | 'bottom-image';
}

/**
 * World-Class PDF Service for Illustrated Storybooks
 * 
 * Creates premium PDFs with:
 * - Context-aware image placement
 * - Beautiful typography
 * - Page layouts optimized for each scene
 * - Cover page and table of contents
 * - Footer branding
 */
export class PDFService implements PDFPort {
    private readonly PAGE_WIDTH = 210; // A4 mm
    private readonly PAGE_HEIGHT = 297; // A4 mm
    private readonly MARGIN = 15;
    private readonly CONTENT_WIDTH = 180;

    // Brand colors
    private readonly COLORS = {
        primary: '#8B4513',      // Saddle brown
        secondary: '#D2691E',    // Chocolate
        accent: '#F4A460',       // Sandy brown
        text: '#3C2415',         // Dark brown
        textLight: '#6B5344',    // Medium brown
        background: '#FFF8F0',   // Warm white
        cream: '#FFFAF0',        // Floral white
    };

    /**
     * Generate a simple book from chapters (backward compatible)
     */
    async generateBook(chapters: { title: string; content: string }[], photos: string[]): Promise<Buffer> {
        const doc = new jsPDF();

        // Title Page
        this.addSimpleTitlePage(doc, "My Life Story");

        // Chapters
        chapters.forEach((ch, index) => {
            if (index > 0) doc.addPage();
            this.addSimpleChapterPage(doc, ch.title, ch.content);
        });

        const arrayBuffer = doc.output('arraybuffer');
        return Buffer.from(arrayBuffer);
    }

    /**
     * Generate an illustrated storybook PDF (World-Class)
     */
    async generateIllustratedStorybook(storybook: StorybookData): Promise<Buffer> {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [210, 148.5], // A5 landscape for storybook feel
        });

        // 1. Cover Page
        await this.addStorybookCover(doc, storybook);

        // 2. Inner Title Page
        doc.addPage();
        this.addInnerTitlePage(doc, storybook);

        // 3. Story Pages with Images
        for (const scene of storybook.scenes) {
            doc.addPage();
            await this.addIllustratedPage(doc, scene, storybook.metadata);
        }

        // 4. Closing Page
        doc.addPage();
        this.addClosingPage(doc, storybook);

        const arrayBuffer = doc.output('arraybuffer');
        return Buffer.from(arrayBuffer);
    }

    /**
     * Generate PDF for a single chapter
     */
    async generateChapterPdf(chapter: {
        id: string;
        title: string;
        content: string;
        excerpt?: string;
        createdAt: Date
    }): Promise<Buffer> {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(24);
        const titleColor = this.hexToRgb(this.COLORS.primary);
        doc.setTextColor(titleColor.r, titleColor.g, titleColor.b);
        doc.text(chapter.title, 20, 30);

        // Date
        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        const dateStr = chapter.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(dateStr, 20, 40);

        // Excerpt
        if (chapter.excerpt) {
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            const excerptText = doc.splitTextToSize(chapter.excerpt, 170);
            doc.text(excerptText, 20, 55);
        }

        // Content
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        const startY = chapter.excerpt ? 75 : 55;
        const splitContent = doc.splitTextToSize(chapter.content, 170);
        this.addMultiPageText(doc, splitContent, 20, startY, 7);

        // Footer
        this.addFooter(doc);

        const arrayBuffer = doc.output('arraybuffer');
        return Buffer.from(arrayBuffer);
    }

    // =========================================================================
    // Private: Storybook Pages
    // =========================================================================

    private async addStorybookCover(doc: jsPDF, storybook: StorybookData): Promise<void> {
        const pageWidth = 210;
        const pageHeight = 148.5;

        // Gradient background (simulated with rectangles)
        this.addWarmGradientBackground(doc, pageWidth, pageHeight);

        // Decorative frame
        const accentColor = this.hexToRgb(this.COLORS.accent);
        doc.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
        doc.setLineWidth(2);
        doc.roundedRect(10, 10, pageWidth - 20, pageHeight - 20, 8, 8);

        // Title
        doc.setFontSize(28);
        const coverTitleColor = this.hexToRgb(this.COLORS.primary);
        doc.setTextColor(coverTitleColor.r, coverTitleColor.g, coverTitleColor.b);
        doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(storybook.title, pageWidth - 60);
        doc.text(titleLines, pageWidth / 2, 50, { align: 'center' });

        // Decorative line
        const secondaryColor = this.hexToRgb(this.COLORS.secondary);
        doc.setDrawColor(secondaryColor.r, secondaryColor.g, secondaryColor.b);
        doc.setLineWidth(0.5);
        doc.line(60, 75, pageWidth - 60, 75);

        // Subtitle
        doc.setFontSize(14);
        const subtitleColor = this.hexToRgb(this.COLORS.textLight);
        doc.setTextColor(subtitleColor.r, subtitleColor.g, subtitleColor.b);
        doc.setFont('helvetica', 'italic');
        doc.text('A Children\'s Storybook', pageWidth / 2, 90, { align: 'center' });

        // Character name
        if (storybook.metadata.characterName) {
            doc.setFontSize(16);
            doc.setFont('helvetica', 'normal');
            doc.text(`Featuring ${storybook.metadata.characterName}`, pageWidth / 2, 105, { align: 'center' });
        }

        // Footer
        doc.setFontSize(10);
        const footerColor = this.hexToRgb(this.COLORS.textLight);
        doc.setTextColor(footerColor.r, footerColor.g, footerColor.b);
        doc.text('Made with ❤️ by Evermore', pageWidth / 2, pageHeight - 15, { align: 'center' });
    }

    private addInnerTitlePage(doc: jsPDF, storybook: StorybookData): void {
        const pageWidth = 210;
        const pageHeight = 148.5;

        const creamColor = this.hexToRgb(this.COLORS.cream);
        doc.setFillColor(creamColor.r, creamColor.g, creamColor.b);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Dedication-style text
        doc.setFontSize(14);
        const dedicationColor = this.hexToRgb(this.COLORS.textLight);
        doc.setTextColor(dedicationColor.r, dedicationColor.g, dedicationColor.b);
        doc.setFont('helvetica', 'italic');
        doc.text('For the little ones who love stories...', pageWidth / 2, 50, { align: 'center' });

        // Story info
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Time Period: ${storybook.metadata.timePeriod}`, pageWidth / 2, 80, { align: 'center' });
        doc.text(`Pages: ${storybook.metadata.totalPages}`, pageWidth / 2, 90, { align: 'center' });

        // Date
        doc.setFontSize(10);
        doc.text(
            `Generated: ${storybook.metadata.generatedAt.toLocaleDateString()}`,
            pageWidth / 2,
            pageHeight - 20,
            { align: 'center' }
        );
    }

    private async addIllustratedPage(
        doc: jsPDF,
        scene: EnhancedScene,
        metadata: StorybookData['metadata']
    ): Promise<void> {
        const pageWidth = 210;
        const pageHeight = 148.5;
        const margin = 10;

        // Background
        const bgColor = this.hexToRgb(this.COLORS.cream);
        doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Add image if available
        if (scene.image?.base64) {
            await this.addSceneImage(doc, scene, pageWidth, pageHeight, margin);
        }

        // Add text based on layout
        this.addSceneText(doc, scene, pageWidth, pageHeight, margin);

        // Page number
        doc.setFontSize(9);
        const colorLight = this.hexToRgb(this.COLORS.textLight);
        doc.setTextColor(colorLight.r, colorLight.g, colorLight.b);
        doc.text(`${scene.pageNumber}`, pageWidth - margin, pageHeight - 5);
    }

    private async addSceneImage(
        doc: jsPDF,
        scene: EnhancedScene,
        pageWidth: number,
        pageHeight: number,
        margin: number
    ): Promise<void> {
        if (!scene.image?.base64) return;

        try {
            let imgX = margin, imgY = margin, imgWidth = 0, imgHeight = 0;

            switch (scene.layout) {
                case 'full-bleed':
                    imgX = 0;
                    imgY = 0;
                    imgWidth = pageWidth;
                    imgHeight = pageHeight * 0.65;
                    break;
                case 'top-image':
                    imgWidth = pageWidth - (margin * 2);
                    imgHeight = pageHeight * 0.5;
                    break;
                case 'bottom-image':
                    imgY = pageHeight * 0.5;
                    imgWidth = pageWidth - (margin * 2);
                    imgHeight = pageHeight * 0.45;
                    break;
                case 'left-image':
                    imgWidth = pageWidth * 0.45;
                    imgHeight = pageHeight - (margin * 2);
                    break;
                case 'right-image':
                    imgX = pageWidth * 0.5 + margin;
                    imgWidth = pageWidth * 0.45 - margin;
                    imgHeight = pageHeight - (margin * 2);
                    break;
            }

            // Handle different image formats
            const format = scene.image.mimeType.includes('svg')
                ? 'SVG'
                : scene.image.mimeType.includes('png')
                    ? 'PNG'
                    : 'JPEG';

            // For SVG, we need special handling - convert to data URL
            if (format === 'SVG') {
                const svgDataUrl = `data:image/svg+xml;base64,${scene.image.base64}`;
                // jsPDF doesn't natively support SVG, so we add a placeholder with text
                doc.setFillColor(240, 235, 230);
                doc.roundedRect(imgX, imgY, imgWidth, imgHeight, 5, 5, 'F');

                doc.setFontSize(10);
                const colorLightSvg = this.hexToRgb(this.COLORS.textLight);
                doc.setTextColor(colorLightSvg.r, colorLightSvg.g, colorLightSvg.b);
                doc.text('[Illustration]', imgX + imgWidth / 2, imgY + imgHeight / 2, { align: 'center' });
            } else {
                doc.addImage(
                    `data:${scene.image.mimeType};base64,${scene.image.base64}`,
                    format,
                    imgX,
                    imgY,
                    imgWidth,
                    imgHeight
                );
            }
        } catch (error) {
            console.error(`Failed to add image for page ${scene.pageNumber}:`, error);
            // Add placeholder rectangle
            doc.setFillColor(240, 235, 230);
            doc.rect(margin, margin, pageWidth - margin * 2, pageHeight * 0.4, 'F');
        }
    }

    private addSceneText(
        doc: jsPDF,
        scene: EnhancedScene,
        pageWidth: number,
        pageHeight: number,
        margin: number
    ): void {
        let textX = margin, textY = margin, textWidth = pageWidth - (margin * 2);

        switch (scene.layout) {
            case 'full-bleed':
                textY = pageHeight * 0.68;
                textWidth = pageWidth - (margin * 2);
                break;
            case 'top-image':
                textY = pageHeight * 0.55;
                break;
            case 'bottom-image':
                // Text is at top
                break;
            case 'left-image':
                textX = pageWidth * 0.5 + margin;
                textWidth = pageWidth * 0.45 - margin;
                break;
            case 'right-image':
                textWidth = pageWidth * 0.45;
                break;
        }

        // Story text
        doc.setFontSize(12);
        const colorText = this.hexToRgb(this.COLORS.text);
        doc.setTextColor(colorText.r, colorText.g, colorText.b);
        doc.setFont('helvetica', 'normal');

        const lines = doc.splitTextToSize(scene.storyText, textWidth);
        const lineHeight = 6;

        lines.forEach((line: string, index: number) => {
            if (textY + (index * lineHeight) < pageHeight - margin) {
                doc.text(line, textX, textY + (index * lineHeight));
            }
        });
    }

    private addClosingPage(doc: jsPDF, storybook: StorybookData): void {
        const pageWidth = 210;
        const pageHeight = 148.5;

        this.addWarmGradientBackground(doc, pageWidth, pageHeight);

        // The End
        doc.setFontSize(32);
        const colorPrimary = this.hexToRgb(this.COLORS.primary);
        doc.setTextColor(colorPrimary.r, colorPrimary.g, colorPrimary.b);
        doc.setFont('helvetica', 'bolditalic');
        doc.text('The End', pageWidth / 2, 50, { align: 'center' });

        // Decorative flourish
        doc.setFontSize(24);
        doc.text('✿ ✿ ✿', pageWidth / 2, 70, { align: 'center' });

        // Thank you message
        doc.setFontSize(12);
        const thankYouColor = this.hexToRgb(this.COLORS.textLight);
        doc.setTextColor(thankYouColor.r, thankYouColor.g, thankYouColor.b);
        doc.setFont('helvetica', 'italic');
        doc.text(
            'Thank you for sharing this precious story.',
            pageWidth / 2,
            100,
            { align: 'center' }
        );

        // Evermore branding
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(
            'Created with Evermore - Preserving Memories for Generations',
            pageWidth / 2,
            pageHeight - 20,
            { align: 'center' }
        );
    }

    // =========================================================================
    // Private: Utilities
    // =========================================================================

    private addSimpleTitlePage(doc: jsPDF, title: string): void {
        doc.setFontSize(24);
        doc.text(title, 105, 100, { align: "center" });
        doc.setFontSize(12);
        doc.text("A Biography", 105, 110, { align: "center" });
    }

    private addSimpleChapterPage(doc: jsPDF, title: string, content: string): void {
        doc.setFontSize(18);
        doc.text(title, 20, 20);
        doc.setFontSize(12);
        const splitText = doc.splitTextToSize(content, 170);
        doc.text(splitText, 20, 40);
    }

    private addMultiPageText(
        doc: jsPDF,
        lines: string[],
        x: number,
        startY: number,
        lineHeight: number
    ): void {
        let currentY = startY;
        const pageHeight = doc.internal.pageSize.height - 20;

        lines.forEach((line: string) => {
            if (currentY + lineHeight > pageHeight) {
                doc.addPage();
                currentY = 20;
            }
            doc.text(line, x, currentY);
            currentY += lineHeight;
        });
    }

    private addFooter(doc: jsPDF): void {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Generated with Evermore - Your Memory Companion', 105, pageHeight - 10, { align: 'center' });
    }

    private addWarmGradientBackground(doc: jsPDF, width: number, height: number): void {
        // Simulate gradient with multiple rectangles
        const steps = 10;
        for (let i = 0; i < steps; i++) {
            const ratio = i / steps;
            const r = Math.round(255 - (ratio * 10));
            const g = Math.round(248 - (ratio * 15));
            const b = Math.round(240 - (ratio * 20));
            doc.setFillColor(r, g, b);
            doc.rect(0, (height / steps) * i, width, height / steps + 1, 'F');
        }
    }

    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
            : { r: 0, g: 0, b: 0 };
    }
}
