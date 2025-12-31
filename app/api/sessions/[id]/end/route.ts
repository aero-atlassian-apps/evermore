import { endSessionUseCase } from '@/lib/infrastructure/di/container';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await endSessionUseCase.execute(id);

    return NextResponse.json({
      success: true,
      sessionId: id,
      estimatedCompletionTime: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Error ending session:', error);
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
}
