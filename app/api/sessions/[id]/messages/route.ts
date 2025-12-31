import { processMessageUseCase } from '@/lib/infrastructure/di/container';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { message, speaker } = await req.json();
    const { id } = await params;

    const result = await processMessageUseCase.execute(id, message, speaker);

    if (result) {
        return NextResponse.json({
            id: `msg-${Date.now() + 1}`,
            speaker: 'agent',
            text: result.text,
            timestamp: new Date().toISOString(),
            strategy: result.strategy
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
