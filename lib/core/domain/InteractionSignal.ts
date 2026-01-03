/**
 * Interaction Signal - Core domain entity for data flywheel.
 * 
 * Captures every meaningful user interaction for preference learning.
 * This is THE foundation of the $100M data moat.
 * 
 * @module InteractionSignal
 * @boundedContext InteractionSignals
 */

// Domain-local emotion type (avoids cross-context dependency)
export type EmotionCategory = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral' | 'anxiety' | 'contentment';

// ============================================================================
// Types
// ============================================================================

/**
 * Audio features extracted from voice input.
 */
export interface AudioFeatures {
    /** Speaking rate (words per minute) */
    speakingRate: number;
    /** Pitch variation coefficient */
    pitchVariation: number;
    /** Energy level (RMS) */
    energyLevel: number;
    /** Pause frequency */
    pauseFrequency: number;
    /** Voice quality indicators */
    voiceQuality: {
        tremor: boolean;
        breathiness: number;
        clarity: number;
    };
}

/**
 * Implicit feedback signals derived from user behavior.
 */
export interface ImplicitFeedback {
    /** Whether user continued the conversation */
    sessionContinued: boolean;
    /** Number of follow-up questions asked */
    followUpQuestions: number;
    /** Whether user changed topic (possible dissatisfaction) */
    topicChange: boolean;
    /** How the conversation segment ended */
    conversationEndedBy: 'user' | 'system' | 'timeout' | 'ongoing';
    /** Time spent before responding (engagement signal) */
    responseDelayMs: number;
    /** Word count of user's next message */
    nextMessageLength: number;
}

/**
 * Core interaction signal entity.
 * Immutable after creation.
 */
export interface InteractionSignal {
    /** Unique identifier */
    readonly id: string;
    /** User who generated this signal */
    readonly userId: string;
    /** Session context */
    readonly sessionId: string;
    /** When the interaction occurred */
    readonly timestamp: number;

    // =========================================================================
    // Input Signals
    // =========================================================================

    /** Original user input text */
    readonly inputText: string;
    /** Audio features if voice input */
    readonly inputAudioFeatures?: AudioFeatures;
    /** Detected emotion from EmpathyEngine */
    readonly detectedEmotion: EmotionCategory;
    /** Confidence of emotion detection (0-1) */
    readonly emotionConfidence: number;
    /** Detected intent category */
    readonly intentCategory: string;

    // =========================================================================
    // Output Signals
    // =========================================================================

    /** ID of the response generated */
    readonly responseId: string;
    /** Response latency in ms */
    readonly responseLatencyMs: number;
    /** Model used for generation */
    readonly modelUsed: string;
    /** Response text (truncated to 500 chars for storage) */
    readonly responsePreview: string;
    /** Number of agent steps taken */
    readonly agentStepCount: number;

    // =========================================================================
    // Feedback Signals (THE GOLD)
    // =========================================================================

    /** Explicit user rating (1-5) if provided */
    readonly explicitFeedback?: number;
    /** Implicit behavioral feedback */
    readonly implicitFeedback: ImplicitFeedback;
    /** Computed satisfaction score (0-1) */
    readonly satisfactionScore: number;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new interaction signal.
 */
export function createInteractionSignal(
    params: Omit<InteractionSignal, 'id' | 'timestamp' | 'satisfactionScore'>
): InteractionSignal {
    const id = `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Compute satisfaction score from explicit + implicit signals
    const satisfactionScore = computeSatisfactionScore(
        params.explicitFeedback,
        params.implicitFeedback
    );

    return {
        id,
        timestamp,
        satisfactionScore,
        ...params,
    };
}

/**
 * Compute satisfaction score from available signals.
 * Range: 0-1 where 1 = highly satisfied
 */
function computeSatisfactionScore(
    explicit?: number,
    implicit?: ImplicitFeedback
): number {
    // If explicit feedback exists, weight it heavily
    if (explicit !== undefined) {
        const explicitNormalized = (explicit - 1) / 4; // 1-5 → 0-1

        // Blend with implicit if available
        if (implicit) {
            const implicitScore = computeImplicitScore(implicit);
            return explicitNormalized * 0.7 + implicitScore * 0.3;
        }
        return explicitNormalized;
    }

    // Implicit only
    if (implicit) {
        return computeImplicitScore(implicit);
    }

    // No feedback = neutral
    return 0.5;
}

/**
 * Compute implicit satisfaction from behavioral signals.
 */
function computeImplicitScore(feedback: ImplicitFeedback): number {
    let score = 0.5; // Start neutral

    // Positive signals
    if (feedback.sessionContinued) score += 0.15;
    if (feedback.followUpQuestions > 0) score += Math.min(0.15, feedback.followUpQuestions * 0.05);
    if (feedback.nextMessageLength > 20) score += 0.1;

    // Negative signals
    if (feedback.topicChange) score -= 0.1;
    if (feedback.conversationEndedBy === 'user') score -= 0.05;
    if (feedback.conversationEndedBy === 'timeout') score -= 0.15;
    if (feedback.responseDelayMs > 30000) score -= 0.1; // Long wait = disengagement

    // Clamp to 0-1
    return Math.max(0, Math.min(1, score));
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate an interaction signal.
 */
export function validateInteractionSignal(signal: InteractionSignal): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!signal.id) errors.push('Missing id');
    if (!signal.userId) errors.push('Missing userId');
    if (!signal.sessionId) errors.push('Missing sessionId');
    if (!signal.inputText) errors.push('Missing inputText');
    if (!signal.responseId) errors.push('Missing responseId');
    if (signal.satisfactionScore < 0 || signal.satisfactionScore > 1) {
        errors.push('satisfactionScore must be 0-1');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// ============================================================================
// Privacy Helpers
// ============================================================================

/**
 * Anonymize a signal for export (remove PII).
 */
export function anonymizeSignal(signal: InteractionSignal): Omit<InteractionSignal, 'userId'> & { userId: string } {
    // Hash user ID for privacy
    const hashedUserId = hashString(signal.userId);

    return {
        ...signal,
        userId: hashedUserId,
        // Truncate input to prevent PII leakage
        inputText: signal.inputText.substring(0, 200),
    };
}

/**
 * Simple string hash for anonymization.
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `anon-${Math.abs(hash).toString(36)}`;
}
