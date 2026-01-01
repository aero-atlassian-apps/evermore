import { NextRequest, NextResponse } from 'next/server';
import { llmProvider, sessionRepository, speechProvider } from '@/lib/infrastructure/di/container';
import { InterjectionAgent } from '@/lib/core/application/agents/InterjectionAgent';
import { logger } from '@/lib/core/application/Logger';

/**
 * POST /api/chat/welcome
 * 
 * Generates a context-aware welcome greeting for a session.
 * Optionally converts to audio via TTS.
 * 
 * Request body:
 * - sessionId: string
 * - userId: string
 * - includeAudio: boolean (optional)
 * 
 * Response:
 * - greeting: string
 * - audioUrl?: string (base64 data URL if includeAudio=true)
 */
export async function POST(request: NextRequest) {
    let userName = 'there';
    try {
        const body = await request.json();
        const { sessionId, userId, includeAudio = false } = body;
        userName = body.userName || 'there';
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();

        if (!sessionId || !userId) {
            return NextResponse.json(
                { error: 'sessionId and userId are required' },
                { status: 400 }
            );
        }

        // For now, we skip memory fetching as memoryRepository may not be exported
        // TODO: Add memory context when repository is available
        const recentMemories: string[] = [];

        // Fetch session goal if available
        let sessionGoal: string | undefined;
        let warmupTopic: string | undefined;
        try {
            const session = await sessionRepository.findById(sessionId);
            if (session?.metadata?.goal) {
                sessionGoal = session.metadata.goal;
            }
            // Get topic from warm-up phase if available
            if (session?.metadata?.warmup_data?.extractedTopic) {
                warmupTopic = session.metadata.warmup_data.extractedTopic;
            }
        } catch (e) {
            logger.warn('[Welcome API] Failed to fetch session', { traceId, error: (e as any)?.message || String(e) });
        }

        // Generate greeting using InterjectionAgent
        const interjectionAgent = new InterjectionAgent(llmProvider);
        const greeting = await interjectionAgent.shouldInterject({
            recentTranscript: [],
            silenceDuration: 0,
            isSessionStart: true,
            userName: userName || 'there',
            recentMemories,
            sessionGoal,
            warmupTopic,
        });

        if (!greeting.shouldInterject || !greeting.message) {
            return NextResponse.json({
                greeting: `Hello ${userName || 'there'}! I'm so glad you're here. What story would you like to share today?`,
                type: 'fallback',
            });
        }

        // Generate TTS audio if requested
        let audioDataUrl: string | undefined;
        if (includeAudio) {
            try {
                const audioBuffer = await speechProvider.textToSpeech(greeting.message);
                const base64 = audioBuffer.toString('base64');
                audioDataUrl = `data:audio/mpeg;base64,${base64}`;
            } catch (e) {
                logger.warn('[Welcome API] TTS failed', { traceId, error: (e as any)?.message || String(e) });
            }
        }

        return NextResponse.json({
            greeting: greeting.message,
            type: greeting.type,
            audioUrl: audioDataUrl,
        });

    } catch (error: any) {
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        logger.error('[Welcome API] Error', { traceId, error: error });
        // GRACEFUL FALLBACK: Return a pre-written greeting instead of error
        // User experience is seamless - they won't know AI failed
        const fallbackGreeting = `Hello ${userName}! I'm so glad you're here today. What memory would you like to share?`;
        return NextResponse.json({
            greeting: fallbackGreeting,
            type: 'fallback',
            // No audio in fallback - client will use Web Speech API
        });
    }
}
