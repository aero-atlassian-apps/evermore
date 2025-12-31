/**
 * Idempotency Layer - Prevents duplicate request processing.
 * 
 * Ensures that retried or duplicate requests return the same result
 * without re-executing the operation.
 * 
 * @module Idempotency
 */

import { logger } from '../Logger';

// ============================================================================
// Types
// ============================================================================

export interface IdempotencyRecord<T = any> {
    /** Idempotency key */
    key: string;
    /** Request fingerprint for validation */
    fingerprint: string;
    /** Stored response */
    response: T;
    /** Status code */
    statusCode: number;
    /** Creation timestamp */
    createdAt: Date;
    /** Expiration timestamp */
    expiresAt: Date;
}

export interface IdempotencyConfig {
    /** TTL for idempotency keys in seconds */
    ttlSeconds: number;
    /** Maximum entries to store */
    maxEntries: number;
    /** Header name for idempotency key */
    headerName: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: IdempotencyConfig = {
    ttlSeconds: 24 * 60 * 60, // 24 hours
    maxEntries: 10000,
    headerName: 'x-idempotency-key',
};

// ============================================================================
// Idempotency Store
// ============================================================================

/**
 * In-memory idempotency store.
 * For production multi-instance, use Redis.
 */
export class IdempotencyStore {
    private static instance: IdempotencyStore;
    private entries: Map<string, IdempotencyRecord> = new Map();
    private config: IdempotencyConfig;
    private cleanupInterval: NodeJS.Timeout | null = null;

    private constructor(config?: Partial<IdempotencyConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60_000);
    }

    static getInstance(config?: Partial<IdempotencyConfig>): IdempotencyStore {
        if (!IdempotencyStore.instance) {
            IdempotencyStore.instance = new IdempotencyStore(config);
        }
        return IdempotencyStore.instance;
    }

    /**
     * Get stored response for idempotency key.
     */
    get<T>(key: string): IdempotencyRecord<T> | null {
        const record = this.entries.get(key) as IdempotencyRecord<T> | undefined;

        if (!record) {
            return null;
        }

        // Check expiration
        if (new Date() > record.expiresAt) {
            this.entries.delete(key);
            return null;
        }

        return record;
    }

    /**
     * Store response for idempotency key.
     */
    set<T>(
        key: string,
        fingerprint: string,
        response: T,
        statusCode: number
    ): void {
        // Enforce max entries with LRU eviction
        if (this.entries.size >= this.config.maxEntries) {
            const oldestKey = this.entries.keys().next().value;
            if (oldestKey) {
                this.entries.delete(oldestKey);
            }
        }

        const now = new Date();
        const record: IdempotencyRecord<T> = {
            key,
            fingerprint,
            response,
            statusCode,
            createdAt: now,
            expiresAt: new Date(now.getTime() + this.config.ttlSeconds * 1000),
        };

        this.entries.set(key, record);
    }

    /**
     * Check if a request is in progress (to prevent concurrent duplicates).
     */
    private inProgress: Set<string> = new Set();

    startProcessing(key: string): boolean {
        if (this.inProgress.has(key)) {
            return false; // Already being processed
        }
        this.inProgress.add(key);
        return true;
    }

    finishProcessing(key: string): void {
        this.inProgress.delete(key);
    }

    isProcessing(key: string): boolean {
        return this.inProgress.has(key);
    }

    /**
     * Clean up expired entries.
     */
    private cleanup(): void {
        const now = new Date();
        for (const [key, record] of this.entries.entries()) {
            if (now > record.expiresAt) {
                this.entries.delete(key);
            }
        }
    }

    /**
     * Get stats for monitoring.
     */
    getStats(): { totalEntries: number; inProgress: number } {
        return {
            totalEntries: this.entries.size,
            inProgress: this.inProgress.size,
        };
    }

    /**
     * Clear all entries (for testing).
     */
    clear(): void {
        this.entries.clear();
        this.inProgress.clear();
    }
}

// ============================================================================
// Request Fingerprinting
// ============================================================================

/**
 * Create a fingerprint for request validation.
 * Ensures the same idempotency key isn't reused for different requests.
 */
export function createRequestFingerprint(body: any, userId?: string): string {
    const data = JSON.stringify({
        body: body || {},
        userId: userId || 'anonymous',
    });

    // Simple hash (for production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
}

// ============================================================================
// Idempotency Middleware Helper
// ============================================================================

export interface IdempotentResult<T> {
    /** Whether this was a cached response */
    cached: boolean;
    /** The response data */
    data: T;
    /** Status code */
    statusCode: number;
}

/**
 * Wrap an operation with idempotency.
 */
export async function withIdempotency<T>(
    key: string | null,
    fingerprint: string,
    operation: () => Promise<{ data: T; statusCode: number }>
): Promise<IdempotentResult<T>> {
    const store = IdempotencyStore.getInstance();

    // If no key provided, just execute
    if (!key) {
        const result = await operation();
        return { cached: false, ...result };
    }

    // Check for existing response
    const existing = store.get<T>(key);
    if (existing) {
        // Validate fingerprint
        if (existing.fingerprint !== fingerprint) {
            logger.warn('Idempotency key reused with different request', {
                key: key.substring(0, 20),
            });
            throw new Error('Idempotency key already used for a different request');
        }

        logger.info('Returning cached idempotent response', {
            key: key.substring(0, 20),
        });
        return {
            cached: true,
            data: existing.response,
            statusCode: existing.statusCode,
        };
    }

    // Check if already processing
    if (!store.startProcessing(key)) {
        throw new Error('Request with this idempotency key is already being processed');
    }

    try {
        // Execute operation
        const result = await operation();

        // Store result
        store.set(key, fingerprint, result.data, result.statusCode);

        return { cached: false, ...result };
    } finally {
        store.finishProcessing(key);
    }
}

/**
 * Extract idempotency key from request headers.
 */
export function extractIdempotencyKey(headers: Headers): string | null {
    return headers.get(DEFAULT_CONFIG.headerName) || null;
}

// Export singleton
export const idempotencyStore = IdempotencyStore.getInstance();
