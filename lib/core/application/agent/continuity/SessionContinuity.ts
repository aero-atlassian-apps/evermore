import { redisService } from '../../../../infrastructure/services/RedisService';
import { logger } from '../../../../infrastructure/logging/LoggerService';

/**
 * In-memory fallback cache for when Redis is unavailable.
 * Simple Map with TTL support for graceful degradation.
 */
class InMemorySessionCache {
    private cache: Map<string, { value: string; expiresAt: number }> = new Map();
    private topics: Map<string, Set<string>> = new Map();
    private readonly MAX_ENTRIES = 1000;
    // M6 hardening: Caps to prevent unbounded growth in topics Map
    private readonly MAX_TOPICS_PER_USER = 100;
    private readonly MAX_USERS_WITH_TOPICS = 500;

    set(key: string, value: string, ttlSeconds: number): void {
        // Enforce max entries (simple LRU-ish eviction)
        if (this.cache.size >= this.MAX_ENTRIES) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    }

    get(key: string): string | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    addTopic(userId: string, topic: string): void {
        // M6 hardening: Cap total users with topics
        if (!this.topics.has(userId) && this.topics.size >= this.MAX_USERS_WITH_TOPICS) {
            // Evict oldest user's topics (first in map)
            const firstUserId = this.topics.keys().next().value;
            if (firstUserId) this.topics.delete(firstUserId);
        }

        if (!this.topics.has(userId)) {
            this.topics.set(userId, new Set());
        }

        const userTopics = this.topics.get(userId)!;
        // M6 hardening: Cap topics per user
        if (userTopics.size >= this.MAX_TOPICS_PER_USER) {
            // Evict oldest topic (first in set)
            const firstTopic = userTopics.values().next().value;
            if (firstTopic) userTopics.delete(firstTopic);
        }
        userTopics.add(topic);
    }

    getTopics(userId: string): string[] {
        return Array.from(this.topics.get(userId) || []);
    }
}

// Singleton fallback cache
const fallbackCache = new InMemorySessionCache();

export class SessionContinuityManager {
    private redisAvailable: boolean = true;

    constructor(private userId: string) { }

    async startSession(sessionId: string): Promise<void> {
        logger.info('[SessionContinuity] Started session', { sessionId, userId: this.userId });

        const sessionData = JSON.stringify({ startTime: Date.now(), active: true });
        const sessionKey = `recall:session:${this.userId}:${sessionId}`;
        const activeKey = `recall:user:${this.userId}:activeSession`;
        const ttl = 3600 * 24; // 24h TTL

        try {
            await redisService.set(sessionKey, sessionData, ttl);
            await redisService.set(activeKey, sessionId, ttl);
            this.redisAvailable = true;
        } catch (e) {
            // Graceful degradation: fall back to in-memory cache
            logger.warn('[SessionContinuity] Redis unavailable, using in-memory fallback', {
                error: (e as Error).message,
                sessionId
            });
            this.redisAvailable = false;
            fallbackCache.set(sessionKey, sessionData, ttl);
            fallbackCache.set(activeKey, sessionId, ttl);
        }
    }

    async trackTopicDiscussion(topic: string): Promise<void> {
        logger.debug('[SessionContinuity] Discussed topic', { topic, userId: this.userId });

        const client = redisService.getClient();
        if (client && this.redisAvailable) {
            const key = `recall:user:${this.userId}:topics`;
            try {
                await client.sadd(key, topic);
                await client.expire(key, 3600 * 24 * 30); // 30 days retention
            } catch (e) {
                logger.warn('[SessionContinuity] Redis topic tracking failed, using fallback', {
                    error: (e as Error).message,
                    topic
                });
                this.redisAvailable = false;
                fallbackCache.addTopic(this.userId, topic);
            }
        } else {
            // Redis not available, use fallback
            fallbackCache.addTopic(this.userId, topic);
        }
    }

    /**
     * Get discussed topics (from Redis or fallback cache).
     */
    async getDiscussedTopics(): Promise<string[]> {
        const client = redisService.getClient();
        if (client && this.redisAvailable) {
            try {
                const key = `recall:user:${this.userId}:topics`;
                const topics = await client.smembers(key);
                return topics;
            } catch (e) {
                logger.warn('[SessionContinuity] Failed to get topics from Redis', {
                    error: (e as Error).message
                });
            }
        }
        // Fallback
        return fallbackCache.getTopics(this.userId);
    }

    /**
     * Check if Redis is currently available.
     */
    isRedisAvailable(): boolean {
        return this.redisAvailable;
    }
}
