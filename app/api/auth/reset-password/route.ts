import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ResetPasswordSchema = z.object({
    email: z.string().email(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email } = ResetPasswordSchema.parse(body);

        // TODO: Integrate with Email Service Provider (SendGrid/AWS SES)
        // For now, we log the intent which would be picked up by our email worker
        // or sent directly if provider was configured.
        console.log(`[Auth] Password reset requested for: ${email}`);

        // We always return success to prevent email enumeration
        return NextResponse.json({ success: true, message: 'If that email exists, we sent a link.' });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
