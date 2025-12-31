/**
 * Vertex AI Health Check API
 * 
 * Checks if Vertex AI (Google Cloud) is available and has quota.
 * Used to determine if conversation can proceed normally or needs offline mode.
 */

import { NextResponse } from 'next/server';
import { llmProvider } from '@/lib/infrastructure/di/container';

export async function GET() {
    try {
        // Check if we have Google Cloud credentials configured
        const hasCredentials = !!(
            process.env.GOOGLE_APPLICATION_CREDENTIALS ||
            process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64
        );
        const hasProject = !!process.env.GOOGLE_CLOUD_PROJECT;

        if (!hasCredentials || !hasProject) {
            return NextResponse.json({
                available: false,
                reason: 'not_configured',
                message: 'Google Cloud credentials not configured'
            });
        }

        // Try a minimal LLM call to verify the API is working
        // This is a very cheap call just to check connectivity and quota
        try {
            const testResult = await llmProvider.generateText(
                'Reply with just the word "ok"',
                { maxTokens: 5, temperature: 0 }
            );

            if (testResult) {
                console.log('[Vertex AI Health] Service available');
                return NextResponse.json({
                    available: true,
                    reason: 'ok',
                    message: 'Vertex AI service available'
                });
            }
        } catch (llmError: any) {
            console.warn('[Vertex AI Health] LLM test failed:', llmError.message);

            // Check for quota/billing errors
            const errorMessage = llmError.message?.toLowerCase() || '';
            if (
                errorMessage.includes('quota') ||
                errorMessage.includes('billing') ||
                errorMessage.includes('exceeded') ||
                errorMessage.includes('limit')
            ) {
                return NextResponse.json({
                    available: false,
                    reason: 'quota_exceeded',
                    message: 'Google Cloud quota exceeded'
                });
            }

            if (
                errorMessage.includes('credentials') ||
                errorMessage.includes('authentication') ||
                errorMessage.includes('unauthorized')
            ) {
                return NextResponse.json({
                    available: false,
                    reason: 'auth_error',
                    message: 'Google Cloud authentication failed'
                });
            }

            // Generic error
            return NextResponse.json({
                available: false,
                reason: 'service_error',
                message: 'Vertex AI service unavailable'
            });
        }

        return NextResponse.json({
            available: true,
            reason: 'ok',
            message: 'Vertex AI available'
        });

    } catch (error: any) {
        console.error('[Vertex AI Health] Check failed:', error.message);
        return NextResponse.json({
            available: false,
            reason: 'error',
            message: error.message
        });
    }
}
