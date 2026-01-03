import { NextRequest, NextResponse } from 'next/server';
import { featureFlagService } from '@/lib/core/application/services/flags';
import type { EvaluationContext } from '@/lib/core/application/services/flags';
import { logger } from '@/lib/core/application/Logger';

/**
 * POST /api/flags/evaluate
 * 
 * Evaluate a feature flag for the given context.
 * 
 * Request body:
 * - key: string - Feature flag key
 * - context?: EvaluationContext - User context for evaluation
 * 
 * Response:
 * - EvaluationResult
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { key, context = {} } = body as { key: string; context?: EvaluationContext };

        if (!key) {
            return NextResponse.json(
                { error: 'Flag key is required' },
                { status: 400 }
            );
        }

        const result = await featureFlagService.evaluate(key, context);

        return NextResponse.json(result);
    } catch (error) {
        logger.error('[FlagsAPI] Evaluation failed', {
            error: error instanceof Error ? error.message : String(error)
        });

        return NextResponse.json(
            { error: 'Flag evaluation failed' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/flags/evaluate?key=flag-key&userId=user-123
 * 
 * Simple GET endpoint for flag evaluation.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) {
            return NextResponse.json(
                { error: 'Flag key is required' },
                { status: 400 }
            );
        }

        const context: EvaluationContext = {
            userId: searchParams.get('userId') || undefined,
            email: searchParams.get('email') || undefined,
            sessionId: searchParams.get('sessionId') || undefined,
            environment: searchParams.get('environment') || undefined,
        };

        const result = await featureFlagService.evaluate(key, context);

        return NextResponse.json(result);
    } catch (error) {
        logger.error('[FlagsAPI] Evaluation failed', {
            error: error instanceof Error ? error.message : String(error)
        });

        return NextResponse.json(
            { error: 'Flag evaluation failed' },
            { status: 500 }
        );
    }
}
