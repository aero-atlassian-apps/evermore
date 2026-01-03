/**
 * API Rate Limiter - Production-grade rate limiting.
 * 
 * Implements sliding window rate limiting for API endpoints.
 * For production with multiple instances, use upstash/ratelimit with Redis.
 * 
 * @module RateLimiter
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../Logger';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
    /** Maximum requests per window */
    limit: number;
    /** Window duration in seconds */
    windowSeconds: number;
    /** Identifier type */
    identifierType: 'ip' | 'user' | 'session' | 'apiKey';
    /** Custom identifier extractor */
    identifierExtractor?: (req: NextRequest) => string | null;
}

interface RateLimitEntry {
    count: number;
    windowStart: number;
    requests: number[];
}

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    resetAt: Date;
    retryAfterSeconds?: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
    /** Standard API rate limit */
    standard: {
        limit: 100,
        windowSeconds: 60,
        identifierType: 'ip',
    },
    /** Strict limit for expensive operations */
    strict: {
        limit: 10,
        windowSeconds: 60,
        identifierType: 'ip',
    },
    /** Generous limit for authenticated users */
    authenticated: {
        limit: 500,
        windowSeconds: 60,
        identifierType: 'user',
    },
    /** Very strict for LLM-intensive operations */
    llmIntensive: {
        limit: 20,
        windowSeconds: 60,
        identifierType: 'user',
    },
    /** Burst protection */
    burst: {
        limit: 30,
        windowSeconds: 10,
        identifierType: 'ip',
    },
};

// ============================================================================
// In-Memory Rate Limiter (Single Instance)
// ============================================================================

/**
 * In-memory rate limiter using sliding window.
 * 
 * For production multi-instance deployments, replace with:
 * - upstash/ratelimit (serverless Redis)
 * - Redis with lua scripts
 * - Cloudflare Rate Limiting
 */
export class InMemoryRateLimiter {
    private static instance: InMemoryRateLimiter;
    private entries: Map<string, RateLimitEntry> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;

    private constructor() {
        // Cleanup stale entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    static getInstance(): InMemoryRateLimiter {
        if (!InMemoryRateLimiter.instance) {
            InMemoryRateLimiter.instance = new InMemoryRateLimiter();
        }
        return InMemoryRateLimiter.instance;
    }

    /**
     * Check rate limit for an identifier.
     */
    check(identifier: string, config: RateLimitConfig): RateLimitResult {
        const now = Date.now();
        const windowMs = config.windowSeconds * 1000;
        const key = `${identifier}:${config.windowSeconds}`;

        let entry = this.entries.get(key);

        // Initialize or reset if window expired
        if (!entry || now - entry.windowStart > windowMs) {
            entry = {
                count: 0,
                windowStart: now,
                requests: [],
            };
            this.entries.set(key, entry);
        }

        // Sliding window: filter out old requests
        entry.requests = entry.requests.filter(ts => now - ts < windowMs);
        entry.count = entry.requests.length;

        const resetAt = new Date(entry.windowStart + windowMs);
        const remaining = Math.max(0, config.limit - entry.count);

        if (entry.count >= config.limit) {
            const retryAfterSeconds = Math.ceil((resetAt.getTime() - now) / 1000);
            return {
                success: false,
                limit: config.limit,
                remaining: 0,
                resetAt,
                retryAfterSeconds,
            };
        }

        // Record this request
        entry.requests.push(now);
        entry.count = entry.requests.length;

        return {
            success: true,
            limit: config.limit,
            remaining: config.limit - entry.count,
            resetAt,
        };
    }

    /**
     * Clean up stale entries.
     */
    private cleanup(): void {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes

        for (const [key, entry] of this.entries.entries()) {
            if (now - entry.windowStart > maxAge) {
                this.entries.delete(key);
            }
        }
    }

    /**
     * Get stats for monitoring.
     */
    getStats(): { totalKeys: number; oldestEntry: Date | null } {
        let oldest: number | null = null;
        for (const entry of this.entries.values()) {
            if (oldest === null || entry.windowStart < oldest) {
                oldest = entry.windowStart;
            }
        }
        return {
            totalKeys: this.entries.size,
            oldestEntry: oldest ? new Date(oldest) : null,
        };
    }

    /**
     * Clear all entries (for testing).
     */
    clear(): void {
        this.entries.clear();
    }
}

// ============================================================================
// Rate Limit Middleware Helper
// ============================================================================

/**
 * Extract identifier from request.
 */
export function extractIdentifier(req: NextRequest, config: RateLimitConfig): string {
    // Custom extractor takes precedence
    if (config.identifierExtractor) {
        const custom = config.identifierExtractor(req);
        if (custom) return custom;
    }

    switch (config.identifierType) {
        case 'user':
            return req.headers.get('x-user-id') || extractIp(req);
        case 'session':
            return req.cookies.get('session')?.value || extractIp(req);
        case 'apiKey':
            return req.headers.get('x-api-key') || extractIp(req);
        case 'ip':
        default:
            return extractIp(req);
    }
}

/**
 * Extract IP address from request.
 */
function extractIp(req: NextRequest): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'
    );
}

/**
 * Create rate limit headers for response.
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());
    if (result.retryAfterSeconds) {
        headers.set('Retry-After', result.retryAfterSeconds.toString());
    }
    return headers;
}

/**
 * Rate limit middleware wrapper.
 */
export function withRateLimit(
    handler: (req: NextRequest) => Promise<NextResponse>,
    config: RateLimitConfig = RATE_LIMIT_PRESETS.standard
): (req: NextRequest) => Promise<NextResponse> {
    const limiter = InMemoryRateLimiter.getInstance();

    return async (req: NextRequest) => {
        const identifier = extractIdentifier(req, config);
        const result = limiter.check(identifier, config);

        if (!result.success) {
            logger.warn('Rate limit exceeded', {
                identifier: identifier.substring(0, 20), // Don't log full IPs
                limit: result.limit,
                retryAfter: result.retryAfterSeconds,
            });

            return new NextResponse(
                JSON.stringify({
                    error: 'Too Many Requests',
                    retryAfter: result.retryAfterSeconds,
                }),
                {
                    status: 429,
                    headers: createRateLimitHeaders(result),
                }
            );
        }

        const response = await handler(req);

        // Add rate limit headers to successful response
        const headers = createRateLimitHeaders(result);
        for (const [key, value] of headers.entries()) {
            response.headers.set(key, value);
        }

        return response;
    };
}

/**
 * Simple rate limit check for use in API routes.
 */
export function checkRateLimit(
    req: NextRequest,
    config: RateLimitConfig = RATE_LIMIT_PRESETS.standard
): RateLimitResult {
    const limiter = InMemoryRateLimiter.getInstance();
    const identifier = extractIdentifier(req, config);
    return limiter.check(identifier, config);
}

// ============================================================================
// Redis Rate Limiter (Distributed)
// ============================================================================

/**
 * Redis-based rate limiter using sliding window with Lua script.
 * 
 * Uses atomic Lua script for accurate distributed rate limiting.
 * Automatically falls back to in-memory if Redis unavailable.
 */
export class RedisRateLimiter {
    private static instance: RedisRateLimiter;
    private redisClient: import('ioredis').default | null = null;
    private fallbackLimiter: InMemoryRateLimiter;
    private initialized = false;

    // Lua script for atomic sliding window rate limiting
    private readonly slidingWindowScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        
        -- Remove expired entries
        redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
        
        -- Count current requests
        local count = redis.call('ZCARD', key)
        
        if count < limit then
            -- Add new request
            redis.call('ZADD', key, now, now .. '-' .. math.random())
            redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
            return {1, limit - count - 1, now + window}
        else
            -- Rate limited
            local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
            local resetAt = oldest[2] and (tonumber(oldest[2]) + window) or (now + window)
            return {0, 0, resetAt}
        end
    `;

    private constructor() {
        this.fallbackLimiter = InMemoryRateLimiter.getInstance();
    }

    static getInstance(): RedisRateLimiter {
        if (!RedisRateLimiter.instance) {
            RedisRateLimiter.instance = new RedisRateLimiter();
        }
        return RedisRateLimiter.instance;
    }

    /**
     * Initialize Redis connection lazily.
     */
    private async ensureInitialized(): Promise<boolean> {
        if (this.initialized) {
            return this.redisClient !== null;
        }

        try {
            // Dynamic import to avoid circular dependencies
            const { getRedisClient } = await import('@/lib/infrastructure/adapters/cache/redis-connection');
            this.redisClient = getRedisClient();
            this.initialized = true;

            if (this.redisClient) {
                logger.info('[RateLimiter] Redis rate limiter initialized');
            } else {
                logger.warn('[RateLimiter] Redis unavailable, using in-memory fallback');
            }

            return this.redisClient !== null;
        } catch (error) {
            logger.warn('[RateLimiter] Failed to initialize Redis, using fallback', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.initialized = true;
            return false;
        }
    }

    /**
     * Check rate limit using Redis or fallback.
     */
    async check(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
        const hasRedis = await this.ensureInitialized();

        if (!hasRedis || !this.redisClient) {
            // Fallback to in-memory
            return this.fallbackLimiter.check(identifier, config);
        }

        try {
            const key = `ratelimit:${identifier}:${config.windowSeconds}`;
            const now = Date.now();
            const windowMs = config.windowSeconds * 1000;

            const result = await this.redisClient.eval(
                this.slidingWindowScript,
                1,
                key,
                now.toString(),
                windowMs.toString(),
                config.limit.toString()
            ) as [number, number, number];

            const [success, remaining, resetAtMs] = result;

            return {
                success: success === 1,
                limit: config.limit,
                remaining,
                resetAt: new Date(resetAtMs),
                retryAfterSeconds: success === 0 ? Math.ceil((resetAtMs - now) / 1000) : undefined,
            };
        } catch (error) {
            logger.warn('[RateLimiter] Redis error, falling back to in-memory', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Fallback on Redis errors
            return this.fallbackLimiter.check(identifier, config);
        }
    }

    /**
     * Check if using Redis or fallback.
     */
    isUsingRedis(): boolean {
        return this.initialized && this.redisClient !== null;
    }
}

// ============================================================================
// Rate Limiter Factory
// ============================================================================

export type RateLimiterType = 'auto' | 'redis' | 'memory';

/**
 * Factory to get appropriate rate limiter.
 * 
 * - 'auto': Use Redis if available, else in-memory
 * - 'redis': Force Redis (throws if unavailable)
 * - 'memory': Force in-memory
 */
export function getRateLimiter(type: RateLimiterType = 'auto'): InMemoryRateLimiter | RedisRateLimiter {
    switch (type) {
        case 'redis':
            return RedisRateLimiter.getInstance();
        case 'memory':
            return InMemoryRateLimiter.getInstance();
        case 'auto':
        default:
            // Prefer Redis when available
            return RedisRateLimiter.getInstance();
    }
}

// ============================================================================
// Updated Rate Limit Middleware
// ============================================================================

/**
 * Rate limit middleware with Redis support.
 */
export function withDistributedRateLimit(
    handler: (req: NextRequest) => Promise<NextResponse>,
    config: RateLimitConfig = RATE_LIMIT_PRESETS.standard
): (req: NextRequest) => Promise<NextResponse> {
    const limiter = RedisRateLimiter.getInstance();

    return async (req: NextRequest) => {
        const identifier = extractIdentifier(req, config);
        const result = await limiter.check(identifier, config);

        if (!result.success) {
            logger.warn('Rate limit exceeded', {
                identifier: identifier.substring(0, 20),
                limit: result.limit,
                retryAfter: result.retryAfterSeconds,
                backend: limiter.isUsingRedis() ? 'redis' : 'memory',
            });

            return new NextResponse(
                JSON.stringify({
                    error: 'Too Many Requests',
                    retryAfter: result.retryAfterSeconds,
                }),
                {
                    status: 429,
                    headers: createRateLimitHeaders(result),
                }
            );
        }

        const response = await handler(req);

        const headers = createRateLimitHeaders(result);
        for (const [key, value] of headers.entries()) {
            response.headers.set(key, value);
        }

        return response;
    };
}

// Export singletons
export const rateLimiter = InMemoryRateLimiter.getInstance();
export const distributedRateLimiter = RedisRateLimiter.getInstance();
