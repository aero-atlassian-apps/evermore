/**
 * Stories API - Combined endpoint for Stories page
 * 
 * Combines profile check + chapters fetch into a single request
 * to eliminate the waterfall effect (reduces 3 API calls to 1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { chapterRepository, userRepository } from '@/lib/infrastructure/di/container';
import { logger } from '@/lib/core/application/Logger';
import { recordHttpRequest } from '@/lib/core/application/observability/Metrics';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const reqStart = Date.now();
    let statusCode = 200;
    try {
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        // 1. Get user from middleware-injected headers
        const userId = request.headers.get('x-user-id');
        const userRole = request.headers.get('x-user-role');

        if (!userId) {
            statusCode = 401;
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get user profile
        const user = await userRepository.findById(userId);
        if (!user) {
            statusCode = 404;
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 3. Check role (only seniors access stories)
        if (user.role !== 'senior') {
            statusCode = 403;
            return NextResponse.json({
                error: 'Access denied',
                redirect: '/family'
            }, { status: 403 });
        }

        // 4. Fetch chapters for this user
        const chapters = await chapterRepository.findByUserId(userId);

        // 5. Return combined response
        return NextResponse.json({
            profile: {
                userId: user.id,
                displayName: user.name,
                role: user.role,
                favoriteChapterIds: user.preferences?.favoriteChapterIds || [],
            },
            chapters: chapters.map(chapter => ({
                id: chapter.id,
                title: chapter.title || 'Untitled Memory',
                content: chapter.content,
                createdAt: chapter.createdAt,
                coverImageUrl: chapter.coverImageUrl,
                bannerImageUrl: chapter.bannerImageUrl,
            })),
        });

    } catch (error: any) {
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        logger.error('[Stories API] Error', { traceId, error: error.message || String(error) });
        statusCode = 500;
        return NextResponse.json(
            { error: 'Failed to fetch stories' },
            { status: 500 }
        );
    } finally {
        try {
            recordHttpRequest('GET', '/api/stories', statusCode, Date.now() - reqStart);
        } catch {
            // no-op
        }
    }
}
