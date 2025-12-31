/**
 * LLMCache - Semantic caching for LLM responses.
 * 
 * Provides TTL-based caching with hash-based keys for:
 * - Intent classification (short TTL)
 * - Safety checks (medium TTL)
 * - Memory retrieval results (medium TTL)
 * 
 * NEVER caches:
 * - Agent reasoning steps
 * - Hallucination checks
 * - User-specific interpolated prompts
 * 
 * @module LLMCache
 */

import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Cached response entry.
 */
interface CacheEntry {
    response: string;
    createdAt: number;
    ttlMs: number;
    hitCount: number;
}

/**
 * Cache options for a specific operation.
 */
export interface CacheOptions {
    /** Cache key prefix for namespacing */
    prefix?: string;
    /** Include these context fields in hash */
    contextFields?: string[];
    /** Time-to-live in milliseconds */
    ttlMs?: number;
    /** Whether this operation is cacheable at all */
    cacheable?: boolean;
}

/**
 * Cache statistics for observability.
 */
export interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    hitRate: number;
}

// ============================================================================
// Default TTL Values
// ============================================================================

export const CACHE_TTLS = {
    INTENT: 5 * 60 * 1000,           // 5 minutes
    SAFETY: 30 * 60 * 1000,          // 30 minutes  
    MEMORY_RETRIEVAL: 10 * 60 * 1000, // 10 minutes
    DEFAULT: 5 * 60 * 1000,          // 5 minutes
};

// ============================================================================
// LLM Cache Implementation
// ============================================================================

export class LLMCache {
    private cache: Map<string, CacheEntry> = new Map();
    private maxSize: number;
    private stats = { hits: 0, misses: 0, evictions: 0 };

    constructor(maxSize: number = 1000) {
        this.maxSize = maxSize;
    }

    /**
     * Generate a hash key for a prompt and options.
     */
    hash(prompt: string, options?: CacheOptions): string {
        const prefix = options?.prefix || 'default';

        // Normalize prompt (trim, lowercase first 200 chars for matching)
        const normalizedPrompt = prompt.trim().slice(0, 500);

        const hash = crypto
            .createHash('sha256')
            .update(normalizedPrompt)
            .digest('hex')
            .slice(0, 16);

        return `${prefix}:${hash}`;
    }

    /**
     * Get a cached response if available and not expired.
     */
    get(key: string): string | null {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check expiration
        const now = Date.now();
        if (now - entry.createdAt > entry.ttlMs) {
            this.cache.delete(key);
            this.stats.misses++;
            this.stats.evictions++;
            return null;
        }

        entry.hitCount++;
        this.stats.hits++;
        console.log(`[LLMCache] HIT key=${key.slice(0, 30)}... hits=${entry.hitCount}`);
        return entry.response;
    }

    /**
     * Store a response in the cache.
     */
    set(key: string, response: string, ttlMs: number = CACHE_TTLS.DEFAULT): void {
        // Evict if at capacity (LRU-like: remove oldest)
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
                this.stats.evictions++;
            }
        }

        this.cache.set(key, {
            response,
            createdAt: Date.now(),
            ttlMs,
            hitCount: 0,
        });
    }

    /**
     * Check if a key exists and is valid.
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        const now = Date.now();
        if (now - entry.createdAt > entry.ttlMs) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Invalidate a specific key.
     */
    invalidate(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Invalidate all keys with a given prefix.
     */
    invalidatePrefix(prefix: string): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear the entire cache.
     */
    clear(): void {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, evictions: 0 };
    }

    /**
     * Get cache statistics.
     */
    getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0,
        };
    }

    /**
     * Prune expired entries (call periodically).
     */
    prune(): number {
        const now = Date.now();
        let pruned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.createdAt > entry.ttlMs) {
                this.cache.delete(key);
                pruned++;
            }
        }

        if (pruned > 0) {
            console.log(`[LLMCache] Pruned ${pruned} expired entries`);
        }
        return pruned;
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: LLMCache | null = null;

export function getLLMCache(): LLMCache {
    if (!instance) {
        instance = new LLMCache();
    }
    return instance;
}

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Generate cache key for intent recognition.
 */
export function intentCacheKey(userId: string, message: string): string {
    return getLLMCache().hash(message, { prefix: `intent:${userId}` });
}

/**
 * Generate cache key for safety checks.
 */
export function safetyCacheKey(message: string): string {
    return getLLMCache().hash(message, { prefix: 'safety' });
}

/**
 * Generate cache key for memory retrieval.
 */
export function memoryCacheKey(userId: string, query: string): string {
    return getLLMCache().hash(query, { prefix: `memory:${userId}` });
}
