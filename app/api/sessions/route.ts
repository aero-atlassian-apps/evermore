import { NextRequest, NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/infrastructure/di/container';

/**
 * GET /api/sessions - List sessions for current user
 * This endpoint is protected by middleware and used for auth validation.
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
        }

        const sessions = await sessionRepository.findByUserId(userId);

        return NextResponse.json({
            sessions: sessions.map(s => ({
                id: s.id,
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                status: s.status,
            }))
        });
    } catch (error) {
        console.error('Failed to fetch sessions:', error);
        return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }
}
