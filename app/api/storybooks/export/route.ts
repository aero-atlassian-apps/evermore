import { NextRequest, NextResponse } from 'next/server';
import { DrizzleChapterRepository } from '@/lib/infrastructure/adapters/db/DrizzleChapterRepository';
import { StorybookService } from '@/lib/infrastructure/adapters/storybook/StorybookService';
import { llmProvider, imageGenerator, pdfService } from '@/lib/infrastructure/di/container';
import { logger } from '@/lib/core/application/Logger';

/**
 * GET /api/storybooks/export
 * 
 * Exports a storybook as an illustrated PDF (browser download).
 * 
 * Query params:
 *   - chapterId: Generate storybook for specific chapter (illustrated)
 *   - type: 'storybook' (default) or 'simple'
 */
export async function GET(req: NextRequest) {
    return handleExport(req);
}

/**
 * POST /api/storybooks/export
 * 
 * Exports a storybook as an illustrated PDF.
 * 
 * Query params:
 *   - chapterId: Generate storybook for specific chapter (illustrated)
 *   - type: 'storybook' (default) or 'simple'
 */
export async function POST(req: NextRequest) {
    return handleExport(req);
}

async function handleExport(req: NextRequest) {
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();

    try {
        // Note: PDF export is accessed by chapter ID, auth not strictly required
        // In production, verify chapter ownership if needed
        const userId = req.headers.get('x-user-id') || 'anonymous';

        const { searchParams } = new URL(req.url);
        const chapterId = searchParams.get('chapterId');
        const chapterIds = searchParams.get('chapterIds')?.split(',').filter(Boolean) || [];
        const exportType = searchParams.get('type') || 'storybook';

        // Get custom title from body if provided
        let customTitle: string | undefined;
        try {
            const body = await req.json();
            customTitle = body?.title;
        } catch {
            // No body or invalid JSON, use default title
        }

        logger.info('Export request received', {
            traceId,
            userId,
            chapterId,
            chapterIds,
            exportType,
            customTitle
        });

        let pdfBuffer: Buffer;
        let filename: string;

        const chapterRepo = new DrizzleChapterRepository();
        const storybookService = new StorybookService(chapterRepo, llmProvider, imageGenerator);

        // Multi-story storybook generation
        if ((chapterIds.length > 0 || chapterId) && exportType === 'storybook') {
            const idsToProcess = chapterIds.length > 0 ? chapterIds : (chapterId ? [chapterId] : []);

            logger.info('Generating illustrated storybook', { traceId, chapterIds: idsToProcess });

            // Generate storybook for each chapter and combine
            const storybooks = await Promise.all(
                idsToProcess.map(id => storybookService.generateStorybook(id))
            );

            // Combine scenes from all storybooks
            const combinedStorybook = {
                id: crypto.randomUUID(),
                chapterId: idsToProcess[0], // Primary chapter for reference
                title: customTitle || (storybooks.length === 1 ? storybooks[0].title : 'My Life Stories'),
                childrenStory: storybooks.map(sb => sb.childrenStory).join('\n\n---\n\n'),
                scenes: storybooks.flatMap(sb => sb.scenes),
                atoms: storybooks[0]?.atoms || {},
                metadata: {
                    generatedAt: new Date(),
                    characterName: storybooks[0]?.metadata?.characterName || 'Narrator',
                    timePeriod: 'Various',
                    totalPages: storybooks.reduce((sum, sb) => sum + sb.scenes.length, 0),
                    style: storybooks[0]?.metadata?.style || 'warm illustration'
                }
            };

            // Generate the illustrated PDF
            pdfBuffer = await pdfService.generateIllustratedStorybook(combinedStorybook);
            filename = `${combinedStorybook.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;

            logger.info('Illustrated storybook exported', {
                traceId,
                chapterCount: idsToProcess.length,
                title: combinedStorybook.title,
                pages: combinedStorybook.scenes.length
            });
        } else {
            // Fallback: Export all chapters as simple book
            logger.info('Generating simple book export', { traceId, userId });

            const chapters = await chapterRepo.findByUserId(userId);

            if (chapters.length === 0) {
                return NextResponse.json(
                    { error: 'No chapters found to export' },
                    { status: 404 }
                );
            }

            const bookContent = chapters.map(ch => ({
                title: ch.title,
                content: ch.content
            }));

            pdfBuffer = await pdfService.generateBook(bookContent, []);
            filename = `my-life-story-${userId.slice(0, 8)}.pdf`;

            logger.info('Simple book exported', { traceId, chapterCount: chapters.length });
        }

        const pdfBytes = new Uint8Array(pdfBuffer);

        return new NextResponse(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBytes.length.toString(),
            },
        });
    } catch (error: any) {
        logger.error('Storybook export failed', {
            traceId,
            error: error.message,
            stack: error.stack?.substring(0, 500),
        });

        return NextResponse.json(
            { error: 'Failed to export storybook', details: error.message },
            { status: 500 }
        );
    }
}
