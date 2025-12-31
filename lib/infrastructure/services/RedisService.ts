
import Redis from 'ioredis';

export class RedisService {
    private client: Redis | null = null;
    private isConnected: boolean = false;
    private hasLoggedConnect: boolean = false;

    constructor(private url?: string) {
        const connectionUrl = url || process.env.REDIS_URL;

        // Only connect if a URL is provided (skip in test/build if missing)
        if (connectionUrl) {
            this.connect(connectionUrl);
        } else {
            console.warn('[RedisService] No REDIS_URL provided. Operating in no-op mode (in-memory fallbacks may be needed).');
        }
    }

    private connect(url: string) {
        try {
            // Upstash requires TLS - convert redis:// to rediss:// for upstash URLs
            const isUpstash = url.includes('upstash.io');
            const finalUrl = isUpstash && url.startsWith('redis://')
                ? url.replace('redis://', 'rediss://')
                : url;

            this.client = new Redis(finalUrl, {
                retryStrategy: (times) => {
                    if (times > 10) return null; // Stop retrying after 10 attempts
                    const delay = Math.min(times * 100, 3000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: false,
                // TLS for Upstash
                ...(isUpstash && { tls: { rejectUnauthorized: false } })
            });

            this.client.on('connect', () => {
                this.isConnected = true;
                if (!this.hasLoggedConnect) {
                    console.log('[RedisService] Connected to Redis' + (isUpstash ? ' (Upstash TLS)' : ''));
                    this.hasLoggedConnect = true;
                }
            });

            this.client.on('error', (err) => {
                this.isConnected = false;
                // Only log unique errors, not every retry
                if (!err.message.includes('max retries')) {
                    console.error('[RedisService] Redis error:', err.message);
                }
            });

            this.client.on('close', () => {
                this.isConnected = false;
            });
        } catch (err) {
            console.error('[RedisService] Failed to initialize Redis client', err);
        }
    }


    async get(key: string): Promise<string | null> {
        if (!this.client || !this.isConnected) return null;
        try {
            return await this.client.get(key);
        } catch (err) {
            return null;
        }
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (!this.client || !this.isConnected) return;
        try {
            if (ttlSeconds) {
                await this.client.set(key, value, 'EX', ttlSeconds);
            } else {
                await this.client.set(key, value);
            }
        } catch (err) {
            console.error(`[RedisService] Failed to set key ${key}`, err);
        }
    }

    async del(key: string): Promise<void> {
        if (!this.client || !this.isConnected) return;
        try {
            await this.client.del(key);
        } catch (err) {
            console.error(`[RedisService] Failed to del key ${key}`, err);
        }
    }

    async expire(key: string, seconds: number): Promise<void> {
        if (!this.client || !this.isConnected) return;
        try {
            await this.client.expire(key, seconds);
        } catch (err) {
            console.error(`[RedisService] Failed to expire key ${key}`, err);
        }
    }

    getClient(): Redis | null {
        return this.client;
    }
}

// Singleton instance
export const redisService = new RedisService();
