import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/infrastructure/adapters/db';
import { chapters } from '@/lib/infrastructure/adapters/db/schema';
import { eq } from 'drizzle-orm';
import { pdfService } from '@/lib/infrastructure/di/container';
import { logger } from '@/lib/core/application/Logger';
import { recordHttpRequest } from '@/lib/core/application/observability/Metrics';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const reqStart = Date.now();
    let statusCode = 200;
    try {
        const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();
        const id = (await params).id;

        // Fetch chapter from database
        const [chapter] = await db.select()
            .from(chapters)
            .where(eq(chapters.id, id))
            .limit(1);

        if (!chapter) {
            statusCode = 404;
            return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }

        // Generate PDF for single chapter
        const pdfBuffer = await pdfService.generateChapterPdf({
            id: chapter.id,
            title: chapter.title,
            content: chapter.content || '',
            excerpt: chapter.excerpt || '',
            createdAt: chapter.createdAt,
        });

        // Return PDF as downloadable file
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${chapter.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`,
            },
        });
    } catch (error: any) {
        const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();
        logger.error('Chapter PDF generation error', { traceId, error: error.message || String(error) });
        statusCode = 500;
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    } finally {
        try {
            recordHttpRequest('GET', '/api/chapters/[id]/pdf', statusCode, Date.now() - reqStart);
        } catch {
            // no-op
        }
    }
}
