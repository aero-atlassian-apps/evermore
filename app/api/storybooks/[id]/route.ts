import { NextRequest, NextResponse } from 'next/server';
import { DrizzleChapterRepository } from '@/lib/infrastructure/adapters/db/DrizzleChapterRepository';
import { storybookOrchestrator } from '@/lib/infrastructure/di/container';
import { logger } from '@/lib/core/application/Logger';

// In-memory cache for storybooks (persists for 1 hour)
const storybookCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(chapterId: string) {
    const cached = storybookCache.get(chapterId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }
    return null;
}

function setCache(chapterId: string, data: any) {
    storybookCache.set(chapterId, { data, timestamp: Date.now() });
}

/**
 * GET /api/storybooks/[id]
 * 
 * Fetches storybook data for the reader UI.
 * If storybook is cached, returns immediately.
 * If not cached, generates it on-the-fly using Agentic Orchestrator.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: chapterId } = await params;
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();

    // Check in-memory cache first (fastest)
    const cached = getCached(chapterId);
    if (cached) {
        logger.info('Returning in-memory cached storybook', { traceId, chapterId });
        return NextResponse.json(cached);
    }

    try {
        // Check database for persisted storybook (saved in chapter metadata)
        const chapterRepo = new DrizzleChapterRepository();
        const chapter = await chapterRepo.findById(chapterId);

        if (chapter?.metadata?.storybook) {
            logger.info('Returning DB-persisted storybook (no regeneration)', { traceId, chapterId });
            const persisted = chapter.metadata.storybook as any;

            const responseData = {
                id: persisted.id || chapterId,
                title: persisted.title,
                scenes: persisted.scenes?.map((scene: any) => ({
                    pageNumber: scene.pageNumber,
                    text: scene.storyText,
                    visualPrompt: scene.imagePrompt,
                    moment: scene.moment,
                    generatedImageUrl: scene.image ? `data:${scene.image.mimeType};base64,${scene.image.base64}` : null
                })) || [],
                metadata: persisted.metadata || {
                    characterName: 'Narrator',
                    timePeriod: 'Long ago',
                    totalPages: persisted.scenes?.length || 0
                }
            };

            // Cache it for faster subsequent access
            setCache(chapterId, responseData);
            return NextResponse.json(responseData);
        }

        // Not in cache or DB - need to generate (first time only!)
        logger.info('Generating storybook for first time (not in DB)', { traceId, chapterId });

        // Generate storybook data using Agentic Orchestrator
        const storybook = await storybookOrchestrator.generateStorybook(chapterId);

        logger.info('Storybook fetched for reader', {
            traceId,
            chapterId,
            title: storybook.title,
            pageCount: storybook.scenes.length
        });

        const responseData = {
            id: storybook.id,
            title: storybook.title,
            scenes: storybook.scenes.map(scene => ({
                pageNumber: scene.pageNumber,
                text: scene.storyText,
                visualPrompt: scene.imagePrompt,
                moment: scene.moment,
                generatedImageUrl: scene.image ? `data:${scene.image.mimeType};base64,${scene.image.base64}` : null
            })),
            metadata: {
                characterName: storybook.metadata.characterName,
                timePeriod: storybook.metadata.timePeriod,
                totalPages: storybook.scenes.length
            }
        };

        // Cache the generated storybook to avoid regeneration
        setCache(chapterId, responseData);

        // PERSISTENCE FIX: Save to DB so Export route can find it independently of cache
        // and without needing to regenerate via AI (critical for offline/export support)
        if (chapter) {
            try {
                const newMetadata = {
                    ...(chapter.metadata || {}),
                    storybook: responseData
                } as any;
                await chapterRepo.update(chapterId, { metadata: newMetadata });
                logger.info('Persisted generated storybook to DB', { traceId, chapterId });
            } catch (dbErr) {
                // Non-blocking error - we still return the content to the user
                logger.error('Failed to persist storybook to DB', { error: dbErr });
            }
        }

        return NextResponse.json(responseData);

    } catch (error: any) {
        logger.error('Failed to fetch storybook', {
            traceId,
            chapterId,
            error: error.message
        });

        return NextResponse.json(
            { error: 'Failed to load storybook', details: error.message },
            { status: 500 }
        );
    }
}
