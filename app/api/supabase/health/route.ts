/**
 * Supabase Health Check API
 * 
 * Checks if Supabase database and storage are available.
 * Used for infrastructure monitoring and resilience decisions.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/infrastructure/adapters/db';
import { sql } from 'drizzle-orm';

export async function GET() {
    let databaseOk = false;
    let storageOk = false;
    let reason = 'unknown';
    let message = '';

    try {
        // Support both naming conventions for compatibility
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                available: false,
                reason: 'not_configured',
                message: 'Supabase credentials not configured',
                database: false,
                storage: false
            });
        }

        // 1. Check Database connectivity via Drizzle
        try {
            await db.execute(sql`SELECT 1`);
            databaseOk = true;
            console.log('[Supabase Health] Database: OK');
        } catch (dbError: any) {
            console.error('[Supabase Health] Database check failed:', dbError.message);
            reason = 'database_error';
            message = dbError.message;
        }

        // 2. Check Storage connectivity
        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { error } = await supabase.storage.listBuckets();

            if (error) throw error;

            storageOk = true;
            console.log('[Supabase Health] Storage: OK');
        } catch (storageError: any) {
            console.error('[Supabase Health] Storage check failed:', storageError.message);
            if (reason === 'unknown') {
                reason = 'storage_error';
                message = storageError.message;
            }
        }

        // Overall status
        const available = databaseOk && storageOk;

        if (available) {
            reason = 'ok';
            message = 'Supabase fully operational';
        }

        return NextResponse.json({
            available,
            reason,
            message,
            database: databaseOk,
            storage: storageOk
        });

    } catch (error: any) {
        console.error('[Supabase Health] Check failed:', error.message);
        return NextResponse.json({
            available: false,
            reason: 'error',
            message: error.message,
            database: databaseOk,
            storage: storageOk
        });
    }
}
