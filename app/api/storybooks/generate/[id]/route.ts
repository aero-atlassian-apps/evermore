import { NextResponse } from 'next/server';
import { DrizzleChapterRepository } from '@/lib/infrastructure/adapters/db/DrizzleChapterRepository';
import { StorybookService } from '@/lib/infrastructure/adapters/storybook/StorybookService';
import { llmProvider, imageGenerator } from '@/lib/infrastructure/di/container';
import { logger } from '@/lib/core/application/Logger';

// Factory for service with full DI
function getStorybookService() {
  const chapterRepo = new DrizzleChapterRepository();
  // Inject llmProvider and imageGenerator from container
  return new StorybookService(chapterRepo, llmProvider, imageGenerator);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const traceId = crypto.randomUUID();

  try {
    const { id } = await params;
    logger.info('Storybook generation requested', { traceId, chapterId: id });

    const service = getStorybookService();
    const result = await service.generateStorybook(id);

    logger.info('Storybook generation complete', {
      traceId,
      chapterId: id,
      pages: result.scenes.length,
      title: result.title
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Storybook generation failed', {
      traceId,
      error: error.message
    });
    return NextResponse.json(
      { error: 'Failed to generate storybook', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const traceId = crypto.randomUUID();

  try {
    const { id } = await params;
    logger.info('Storybook generation (POST) requested', { traceId, chapterId: id });

    const service = getStorybookService();
    const result = await service.generateStorybook(id);

    logger.info('Storybook generation (POST) complete', {
      traceId,
      chapterId: id,
      pages: result.scenes.length
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Storybook generation (POST) failed', {
      traceId,
      error: error.message
    });
    return NextResponse.json(
      { error: 'Failed to generate storybook', details: error.message },
      { status: 500 }
    );
  }
}

