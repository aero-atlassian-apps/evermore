import { NextRequest, NextResponse } from 'next/server';
import { analyzeSessionImageUseCase } from '@/lib/infrastructure/di/container';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { imageBase64, mimeType } = body;

        if (!imageBase64 || !mimeType) {
            return NextResponse.json({ error: "Missing image data" }, { status: 400 });
        }

        const result = await analyzeSessionImageUseCase.execute(id, imageBase64, mimeType);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Image analysis failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
