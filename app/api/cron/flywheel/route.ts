import { NextRequest, NextResponse } from 'next/server';
import { AutoLearningService } from '@/lib/core/application/agent/learning/AutoLearningService';
import { logger } from '@/lib/core/application/Logger';

/**
 * GET /api/cron/flywheel
 * 
 * Periodic task to check if the data flywheel threshold has been met.
 * If met, triggers an autonomous DPO training cycle.
 */
export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    // Security: Ensure CRON_SECRET is set and matches the header
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        logger.info('[CronFlywheel] Running autonomous learning check...');
        const service = AutoLearningService.getInstance();
        const result = await service.checkAndTrigger();

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('[CronFlywheel] Failed to run flywheel task', { error });
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
