/**
 * User Feedback API Endpoint
 * 
 * 100M Roadmap - Phase 1: The Wiring Sprint
 * Captures user star ratings and comments for preference learning.
 * 
 * POST /api/sessions/[id]/feedback
 * Body: { rating: 1-5, executionId?: string, comment?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/infrastructure/adapters/supabase/SupabaseClient';
import { SelfImprovementManager } from '@/lib/core/application/agent/learning/SelfImprovement';

// Singleton for preference learning (in production, use DI container)
const selfImprovementManager = new SelfImprovementManager();

interface FeedbackRequest {
    /** User satisfaction rating 1-5 */
    rating: number;
    /** Optional execution trace ID */
    executionId?: string;
    /** Optional user comment */
    comment?: string;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: sessionId } = await params;

    try {
        const body: FeedbackRequest = await request.json();

        // Validate rating
        if (!body.rating || body.rating < 1 || body.rating > 5) {
            return NextResponse.json(
                { error: 'Rating must be between 1 and 5' },
                { status: 400 }
            );
        }

        // Get user from session
        // Get user from session (expecting Authorization header with Bearer token)
        if (!supabase) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 503 });
        }

        const token = request.headers.get('Authorization')?.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Store feedback in database for persistence
        const { data, error } = await supabase
            .from('session_feedback')
            .insert({
                session_id: sessionId,
                user_id: user.id,
                rating: body.rating,
                execution_id: body.executionId,
                comment: body.comment,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[Feedback API] Database error:', error);
            // Don't fail - still record for learning even if DB fails
        }

        // Wire to SelfImprovementManager for preference learning
        if (body.executionId) {
            selfImprovementManager.addUserFeedback(
                body.executionId,
                body.rating,
                body.comment
            );
            console.log(`[Feedback API] Recorded feedback for execution ${body.executionId}: ${body.rating}/5`);

            // 100M Roadmap - Phase 3: Autonomous Flywheel Trigger
            // We fire-and-forget this to avoid blocking the user response
            import('@/lib/core/application/agent/learning/AutoLearningService')
                .then(({ AutoLearningService }) => {
                    AutoLearningService.getInstance().checkAndTrigger();
                })
                .catch(err => console.error('[Feedback API] Flywheel trigger failed', err));
        }

        return NextResponse.json({
            success: true,
            message: 'Feedback recorded',
            feedbackId: data?.id,
        });

    } catch (error) {
        console.error('[Feedback API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process feedback' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/sessions/[id]/feedback
 * Returns feedback history for a session (for admin/debugging).
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: sessionId } = await params;

    try {
        if (!supabase) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 503 });
        }

        const token = request.headers.get('Authorization')?.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { data, error } = await supabase
            .from('session_feedback')
            .select('*')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Feedback API] Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch feedback' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            feedback: data || [],
        });

    } catch (error) {
        console.error('[Feedback API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch feedback' },
            { status: 500 }
        );
    }
}
