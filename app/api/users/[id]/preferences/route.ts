import { NextRequest, NextResponse } from 'next/server';
import { userProfileUpdater } from '@/lib/infrastructure/di/container';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        // Extract all allowed preference fields
        const {
            topicsAvoid,
            topicsLove,
            voiceTone,
            conversationSchedule,
            timezone,
            emergencyContact
        } = body.updates || body; // Handle nested 'updates' or flat body

        const updates = {
            topicsAvoid,
            topicsLove,
            voiceTone,
            conversationSchedule,
            timezone,
            emergencyContact
        };

        // Remove undefined keys
        Object.keys(updates).forEach(key => (updates as any)[key] === undefined && delete (updates as any)[key]);

        const updatedUser = await userProfileUpdater.updateSeniorProfile(id, updates);

        return NextResponse.json(updatedUser);
    } catch (error: any) {
        console.error('Preferences API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await userProfileUpdater.getProfile(id);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user.preferences || {});
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
