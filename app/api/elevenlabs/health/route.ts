/**
 * ElevenLabs Health Check API
 * 
 * Checks if ElevenLabs is available and has quota.
 * Used to decide whether to show warmup phase.
 */

import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

        // No credentials = not available
        if (!apiKey || !agentId) {
            return NextResponse.json({
                available: false,
                reason: 'not_configured',
                message: 'ElevenLabs credentials not configured'
            });
        }

        // Check subscription/quota via ElevenLabs API
        const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
            headers: {
                'xi-api-key': apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn('[ElevenLabs Health] API error:', response.status, errorText);

            if (response.status === 401) {
                return NextResponse.json({
                    available: false,
                    reason: 'invalid_key',
                    message: 'Invalid API key'
                });
            }

            return NextResponse.json({
                available: false,
                reason: 'api_error',
                message: 'Failed to check ElevenLabs status'
            });
        }

        const data = await response.json();

        // Check if quota is available
        const characterCount = data.character_count || 0;
        const characterLimit = data.character_limit || 0;
        const remaining = characterLimit - characterCount;

        // Need at least 500 characters for a warmup conversation
        const hasQuota = remaining > 500;

        console.log(`[ElevenLabs Health] Quota: ${remaining}/${characterLimit} chars, Available: ${hasQuota}`);

        return NextResponse.json({
            available: hasQuota,
            reason: hasQuota ? 'ok' : 'quota_exceeded',
            message: hasQuota ? 'ElevenLabs available' : 'Quota exceeded',
            quota: {
                used: characterCount,
                limit: characterLimit,
                remaining
            }
        });

    } catch (error: any) {
        console.error('[ElevenLabs Health] Check failed:', error.message);
        return NextResponse.json({
            available: false,
            reason: 'error',
            message: error.message
        });
    }
}
