import { NextRequest, NextResponse } from 'next/server';
import { analyzeSessionImageUseCase } from '@/lib/infrastructure/di/container';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = file.type;

    const result = await analyzeSessionImageUseCase.execute(id, base64, mimeType);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error analyzing image:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
