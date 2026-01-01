/**
 * Stories API - Combined endpoint for Stories page
 * 
 * Combines profile check + chapters fetch into a single request
 * to eliminate the waterfall effect (reduces 3 API calls to 1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/infrastructure/auth/session';
import { chapterRepository, userRepository } from '@/lib/infrastructure/di/container';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        // 1. Verify session
        const session = await verifySession(request);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get user profile
        const user = await userRepository.findById(session.userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 3. Check role (only seniors access stories)
        if (user.role !== 'senior') {
            return NextResponse.json({
                error: 'Access denied',
                redirect: '/family'
            }, { status: 403 });
        }

        // 4. Fetch chapters for this user
        const chapters = await chapterRepository.findByUserId(session.userId);

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
        console.error('[Stories API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stories' },
            { status: 500 }
        );
    }
}
