import { getChaptersUseCase } from '@/lib/infrastructure/di/container';
import { NextResponse } from 'next/server';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawUserId } = await params;

        // Generate a deterministic UUID from non-UUID user IDs (for dev/test users)
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let userId = rawUserId;
        if (!uuidPattern.test(rawUserId)) {
            const crypto = await import('crypto');
            userId = crypto.createHash('md5').update(rawUserId).digest('hex');
            userId = `${userId.slice(0, 8)}-${userId.slice(8, 12)}-${userId.slice(12, 16)}-${userId.slice(16, 20)}-${userId.slice(20, 32)}`;
        }

        // SECURITY: Enforce Ownership
        const authenticatedUserId = req.headers.get('x-user-id');
        if (!authenticatedUserId || authenticatedUserId !== userId) {
            console.warn(`[SECURITY] IDOR Attempt blocked used ${authenticatedUserId} tried to access ${userId}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const chapters = await getChaptersUseCase.execute(userId);
        return NextResponse.json(chapters); // Reverted to Array to match contract
    } catch (error) {
        console.error('Error fetching chapters:', error);
        return NextResponse.json(
            { error: 'Failed to fetch chapters' },
            { status: 500 }
        );
    }
}
