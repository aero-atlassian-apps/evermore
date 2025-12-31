import { NextRequest, NextResponse } from 'next/server';
import { DrizzleChapterRepository } from '@/lib/infrastructure/adapters/db/DrizzleChapterRepository';
import { DrizzleUserRepository } from '@/lib/infrastructure/adapters/db/DrizzleUserRepository';

const chapterRepository = new DrizzleChapterRepository();
const userRepository = new DrizzleUserRepository();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId'); // Family member ID

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const familyUser = await userRepository.findById(userId);
    if (!familyUser) {
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
    console.error('Error fetching chapters:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
