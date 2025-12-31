import { NextRequest, NextResponse } from 'next/server';
import { contentSafetyGuard, userRepository } from '@/lib/infrastructure/di/container';

export async function POST(req: NextRequest) {
  try {
    const { seniorId, sessionId, text } = await req.json();

    if (!seniorId || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get Emergency Contact
    const user = await userRepository.findById(seniorId);
    const emergencyContact = user?.preferences?.emergencyContact?.email;

    // Monitor returns boolean (true if risk detected)
    const riskDetected = await contentSafetyGuard.monitor(text, seniorId, sessionId || 'manual-scan', emergencyContact);

    return NextResponse.json({ riskDetected });
  } catch (error: any) {
    console.error('Error scanning message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
