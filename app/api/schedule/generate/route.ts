import { NextRequest, NextResponse } from 'next/server';
import { invitationScheduler } from '@/lib/infrastructure/di/container';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const invitations = await invitationScheduler.generateScheduleForUser(userId);

    return NextResponse.json({
        message: `Generated ${invitations.length} invitations`,
        invitations
    });
  } catch (error: any) {
    console.error('Error generating schedule:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
