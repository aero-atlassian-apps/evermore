import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/infrastructure/adapters/db';
import { chapters } from '@/lib/infrastructure/adapters/db/schema';
import { eq } from 'drizzle-orm';
import { pdfService } from '@/lib/infrastructure/di/container';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;

        // Fetch chapter from database
        const [chapter] = await db.select()
            .from(chapters)
            .where(eq(chapters.id, id))
            .limit(1);

        if (!chapter) {
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
        console.error('Chapter PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
