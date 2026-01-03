import { NextRequest, NextResponse } from 'next/server';
import { featureFlagService } from '@/lib/core/application/services/flags';
import type { FlagCreate, FlagUpdate } from '@/lib/core/application/services/flags';
import { logger } from '@/lib/core/application/Logger';
import { withPermission } from '@/lib/auth/rbac-middleware';
import { Permission } from '@/lib/auth/roles';

/**
 * GET /api/admin/flags
 * 
 * Get all feature flags.
 */
export const GET = withPermission(Permission.MANAGE_FEATURE_FLAGS, async () => {
    try {
        const flags = await featureFlagService.getAllFlags();
        return NextResponse.json({ flags });
    } catch (error) {
        logger.error('[AdminFlags] Failed to get flags', { error });
        return NextResponse.json(
            { error: 'Failed to get flags' },
            { status: 500 }
        );
    }
});

/**
 * POST /api/admin/flags
 * 
 * Create a new feature flag.
 */
export const POST = withPermission(Permission.MANAGE_FEATURE_FLAGS, async (request: NextRequest) => {
    try {
        const body = await request.json() as FlagCreate;

        if (!body.key || !body.name) {
            return NextResponse.json(
                { error: 'Key and name are required' },
                { status: 400 }
            );
        }

        // Check if flag already exists
        const existing = await featureFlagService.getFlag(body.key);
        if (existing) {
            return NextResponse.json(
                { error: 'Flag already exists' },
                { status: 409 }
            );
        }

        const flag = await featureFlagService.createFlag(body);

        logger.info('[AdminFlags] Flag created', { key: flag.key, name: flag.name });

        return NextResponse.json({ flag }, { status: 201 });
    } catch (error) {
        logger.error('[AdminFlags] Failed to create flag', { error });
        return NextResponse.json(
            { error: 'Failed to create flag' },
            { status: 500 }
        );
    }
});

/**
 * PUT /api/admin/flags
 * 
 * Update a feature flag.
 * Body: { key: string, updates: FlagUpdate }
 */
export const PUT = withPermission(Permission.MANAGE_FEATURE_FLAGS, async (request: NextRequest) => {
    try {
        const body = await request.json() as { key: string; updates: FlagUpdate };

        if (!body.key) {
            return NextResponse.json(
                { error: 'Key is required' },
                { status: 400 }
            );
        }

        const flag = await featureFlagService.updateFlag(body.key, body.updates);

        if (!flag) {
            return NextResponse.json(
                { error: 'Flag not found' },
                { status: 404 }
            );
        }

        logger.info('[AdminFlags] Flag updated', { key: flag.key });

        return NextResponse.json({ flag });
    } catch (error) {
        logger.error('[AdminFlags] Failed to update flag', { error });
        return NextResponse.json(
            { error: 'Failed to update flag' },
            { status: 500 }
        );
    }
});

/**
 * DELETE /api/admin/flags
 * 
 * Delete a feature flag.
 * Body: { key: string }
 */
export const DELETE = withPermission(Permission.MANAGE_FEATURE_FLAGS, async (request: NextRequest) => {
    try {
        const body = await request.json() as { key: string };

        if (!body.key) {
            return NextResponse.json(
                { error: 'Key is required' },
                { status: 400 }
            );
        }

        await featureFlagService.deleteFlag(body.key);

        logger.info('[AdminFlags] Flag deleted', { key: body.key });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[AdminFlags] Failed to delete flag', { error });
        return NextResponse.json(
            { error: 'Failed to delete flag' },
            { status: 500 }
        );
    }
});
