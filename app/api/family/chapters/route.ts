import { NextRequest, NextResponse } from 'next/server';
import { DrizzleChapterRepository } from '@/lib/infrastructure/adapters/db/DrizzleChapterRepository';
import { DrizzleUserRepository } from '@/lib/infrastructure/adapters/db/DrizzleUserRepository';
import { logger } from '@/lib/core/application/Logger';
import { recordHttpRequest } from '@/lib/core/application/observability/Metrics';

const chapterRepository = new DrizzleChapterRepository();
const userRepository = new DrizzleUserRepository();

export async function GET(req: NextRequest) {
  const reqStart = Date.now();
  let statusCode = 200;
  try {
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId'); // Family member ID

    if (!userId) {
      statusCode = 400;
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const familyUser = await userRepository.findById(userId);
    if (!familyUser) {
         statusCode = 404;
         return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (familyUser.role !== 'family') {
        // Just for safety, though technically seniors could view their own too.
        // Allowing senior view for now if needed.
    }

    const seniorId = familyUser.seniorId;
    if (!seniorId) {
        return NextResponse.json({ chapters: [] });
    }

    // Need to find chapters by user ID (senior's ID).
    // DrizzleChapterRepository might need findByUserId method.
    // Let's check DrizzleChapterRepository.ts
    // If it doesn't exist, I will add it.

    const chapters = await chapterRepository.findByUserId(seniorId);

    return NextResponse.json({ chapters });
  } catch (error: any) {
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();
    logger.error('Error fetching chapters', { traceId, error: error.message || String(error) });
    statusCode = 500;
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    try {
      recordHttpRequest('GET', '/api/family/chapters', statusCode, Date.now() - reqStart);
    } catch {
      // no-op
    }
  }
}
