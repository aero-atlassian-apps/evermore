/**
 * Input Sanitization & Validation Utilities
 * 
 * Production-grade input handling for security and cost control.
 * 
 * @module InputSanitization
 */

// ============================================================================
// Configuration
// ============================================================================

export const INPUT_LIMITS = {
    /** Maximum characters in a single message */
    MAX_MESSAGE_LENGTH: 4000, // ~1000 tokens
    /** Maximum characters for session-level context */
    MAX_CONTEXT_LENGTH: 16000,
    /** Maximum size of uploaded images in bytes */
    MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
    /** Maximum length for user names */
    MAX_NAME_LENGTH: 100,
    /** Maximum length for email */
    MAX_EMAIL_LENGTH: 254,
} as const;

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Sanitize user message before sending to LLM.
 * Removes potentially dangerous patterns while preserving intent.
 */
export function sanitizeUserMessage(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    let sanitized = input;

    // 1. Remove null bytes and control characters (except newlines/tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 2. Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // 3. Detect and defuse common prompt injection patterns
    const injectionPatterns = [
        // Instruction override attempts
        /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/gi,
        /forget\s+(everything|previous|all)/gi,
        /disregard\s+(previous|above|your)/gi,
        // System prompt extraction
        /what\s+(is|are)\s+your\s+(instructions?|prompts?|system)/gi,
        /show\s+me\s+(your|the)\s+(prompts?|instructions?)/gi,
        // Role manipulation
        /you\s+are\s+now\s+a/gi,
        /pretend\s+(to\s+be|you're)/gi,
        /act\s+as\s+if/gi,
        // Delimiter injection
        /```system/gi,
        /\[SYSTEM\]/gi,
        /\[\[ADMIN\]\]/gi,
    ];

    for (const pattern of injectionPatterns) {
        if (pattern.test(sanitized)) {
            console.warn('[Sanitization] Potential prompt injection detected and neutralized');
            // Replace with benign placeholder
            sanitized = sanitized.replace(pattern, '[redacted]');
        }
    }

    // 4. Truncate to max length
    if (sanitized.length > INPUT_LIMITS.MAX_MESSAGE_LENGTH) {
        sanitized = sanitized.substring(0, INPUT_LIMITS.MAX_MESSAGE_LENGTH);
        console.warn(`[Sanitization] Message truncated to ${INPUT_LIMITS.MAX_MESSAGE_LENGTH} chars`);
    }

    return sanitized;
}

/**
 * Validate message length and return error if too long.
 */
export function validateMessageLength(message: string): { valid: boolean; error?: string } {
    if (!message) {
        return { valid: false, error: 'Message cannot be empty' };
    }

    if (message.length > INPUT_LIMITS.MAX_MESSAGE_LENGTH) {
        return {
            valid: false,
            error: `Message too long. Maximum ${INPUT_LIMITS.MAX_MESSAGE_LENGTH} characters allowed.`
        };
    }

    return { valid: true };
}

/**
 * Sanitize string for logging (remove PII, truncate).
 */
export function sanitizeForLogging(input: string, maxLength: number = 100): string {
    if (!input) return '[empty]';

    // Remove potential PII patterns
    let sanitized = input
        .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[email]')
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]')
        .replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, '[ssn]');

    // Truncate
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + '...';
    }

    return sanitized;
}

/**
 * Validate and sanitize session ID format.
 */
export function validateSessionId(sessionId: string): { valid: boolean; error?: string } {
    if (!sessionId) {
        return { valid: false, error: 'Session ID required' };
    }

    // UUID format check
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(sessionId)) {
        return { valid: false, error: 'Invalid session ID format' };
    }

    return { valid: true };
}

/**
 * Validate and sanitize user ID format.
 */
export function validateUserId(userId: string): { valid: boolean; error?: string } {
    if (!userId) {
        return { valid: false, error: 'User ID required' };
    }

    // UUID format check
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
        return { valid: false, error: 'Invalid user ID format' };
    }

    return { valid: true };
}

/**
 * Sanitize user name.
 */
export function sanitizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
        .replace(/[<>\"'&]/g, '') // Remove HTML-dangerous chars
        .trim()
        .substring(0, INPUT_LIMITS.MAX_NAME_LENGTH);
}

/**
 * Validate email format.
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email) {
        return { valid: false, error: 'Email required' };
    }

    if (email.length > INPUT_LIMITS.MAX_EMAIL_LENGTH) {
        return { valid: false, error: 'Email too long' };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
}

// ============================================================================
// Request Sanitization Middleware Helper
// ============================================================================

export interface SanitizedChatRequest {
    sessionId: string;
    message: string;
}

/**
 * Sanitize and validate chat request body.
 */
export function sanitizeChatRequest(body: any): {
    valid: boolean;
    data?: SanitizedChatRequest;
    error?: string
} {
    const sessionValidation = validateSessionId(body?.sessionId);
    if (!sessionValidation.valid) {
        return { valid: false, error: sessionValidation.error };
    }

    const messageValidation = validateMessageLength(body?.message);
    if (!messageValidation.valid) {
        return { valid: false, error: messageValidation.error };
    }

    return {
        valid: true,
        data: {
            sessionId: body.sessionId,
            message: sanitizeUserMessage(body.message),
        }
    };
}
