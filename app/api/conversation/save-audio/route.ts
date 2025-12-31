/**
 * Save Audio API - Stores audio in Supabase when Vertex AI is unavailable
 * 
 * This endpoint saves audio recordings to Supabase Storage and creates
 * a pending_audio record for later processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db, pendingAudio, sessions } from '@/lib/infrastructure/adapters/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/core/application/Logger';

// Lazy Supabase client initialization (avoids build-time failures)
let _supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
    if (_supabaseClient) return _supabaseClient;

    // Support both naming conventions for compatibility
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase credentials not configured');
    }

    _supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    return _supabaseClient;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const sessionId = formData.get('sessionId') as string;
        const userId = formData.get('userId') as string;

        if (!file || !sessionId || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields: file, sessionId, userId' },
                { status: 400 }
            );
        }

        // Verify session exists
        const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `pending-audio/${userId}/${sessionId}/${timestamp}.webm`;

        // Upload to Supabase Storage
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const supabase = getSupabaseClient();
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('audio')
            .upload(filename, buffer, {
                contentType: file.type || 'audio/webm',
                upsert: false
            });

        if (uploadError) {
            logger.error('[SaveAudio] Storage upload failed', { error: uploadError.message });
            return NextResponse.json(
                { error: 'Failed to save audio' },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('audio')
            .getPublicUrl(filename);

        const audioUrl = urlData.publicUrl;

        // Create pending_audio record
        const [record] = await db.insert(pendingAudio).values({
            sessionId,
            userId,
            audioUrl,
            audioSize: buffer.length,
            mimeType: file.type || 'audio/webm',
            processed: false
        }).returning();

        logger.info('[SaveAudio] Audio saved for later processing', {
            pendingAudioId: record.id,
            sessionId,
            size: buffer.length
        });

        return NextResponse.json({
            success: true,
            pendingAudioId: record.id,
            audioUrl,
            message: 'Audio saved. Will be processed when service is available.'
        });

    } catch (error: any) {
        logger.error('[SaveAudio] Error saving audio', { error: error.message });
        return NextResponse.json(
            { error: 'Failed to save audio' },
            { status: 500 }
        );
    }
}
