/**
 * Redis Connection Manager
 * 
 * Singleton Redis client with health checks and reconnection logic.
 * Used by distributed rate limiter and other caching needs.
 * 
 * @module redis-connection
 */

import Redis from 'ioredis';
import { logger } from '@/lib/core/application/Logger';

// ============================================================================
// Types
// ============================================================================

export interface RedisConnectionConfig {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
    retryDelayMs?: number;
    connectTimeoutMs?: number;
}

export interface RedisHealthStatus {
    connected: boolean;
    latencyMs: number | null;
    lastError: string | null;
    lastCheck: Date;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<Omit<RedisConnectionConfig, 'url' | 'password'>> = {
    host: 'localhost',
    port: 6379,
    db: 0,
    maxRetriesPerRequest: 3,
    retryDelayMs: 100,
    connectTimeoutMs: 5000,
};

// ============================================================================
// Redis Connection Manager
// ============================================================================

/**
 * Singleton Redis connection manager with health monitoring.
 * 
 * Features:
 * - Lazy connection initialization
 * - Automatic reconnection
 * - Health check endpoint
 * - Graceful degradation when unavailable
 */
export class RedisConnectionManager {
    private static instance: RedisConnectionManager | null = null;
    private client: Redis | null = null;
    private config: RedisConnectionConfig;
    private lastHealthStatus: RedisHealthStatus = {
        connected: false,
        latencyMs: null,
        lastError: null,
        lastCheck: new Date(),
    };

    private constructor(config: RedisConnectionConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get singleton instance.
     */
    static getInstance(config?: RedisConnectionConfig): RedisConnectionManager {
        if (!RedisConnectionManager.instance) {
            RedisConnectionManager.instance = new RedisConnectionManager(config);
        }
        return RedisConnectionManager.instance;
    }

    /**
     * Reset instance (for testing).
     */
    static resetInstance(): void {
        if (RedisConnectionManager.instance?.client) {
            RedisConnectionManager.instance.client.disconnect();
        }
        RedisConnectionManager.instance = null;
    }

    /**
     * Get or create Redis client.
     */
    getClient(): Redis | null {
        if (this.client) {
            return this.client;
        }

        const redisUrl = process.env.REDIS_URL || this.config.url;

        if (!redisUrl && !this.config.host) {
            logger.warn('[Redis] No REDIS_URL configured, Redis features disabled');
            return null;
        }

        try {
            if (redisUrl) {
                this.client = new Redis(redisUrl, {
                    maxRetriesPerRequest: this.config.maxRetriesPerRequest,
                    retryStrategy: (times) => {
                        if (times > 3) {
                            logger.error('[Redis] Max retries exceeded, giving up');
                            return null;
                        }
                        return Math.min(times * this.config.retryDelayMs!, 2000);
                    },
                    lazyConnect: true,
                });
            } else {
                this.client = new Redis({
                    host: this.config.host,
                    port: this.config.port,
                    password: this.config.password,
                    db: this.config.db,
                    maxRetriesPerRequest: this.config.maxRetriesPerRequest,
                    retryStrategy: (times) => {
                        if (times > 3) return null;
                        return Math.min(times * this.config.retryDelayMs!, 2000);
                    },
                    lazyConnect: true,
                });
            }

            this.setupEventHandlers();

            // Attempt connection
            this.client.connect().catch((err) => {
                logger.warn('[Redis] Initial connection failed, will retry on demand', { error: err.message });
            });

            return this.client;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('[Redis] Failed to create client', { error: message });
            this.lastHealthStatus.lastError = message;
            return null;
        }
    }

    /**
     * Setup Redis event handlers.
     */
    private setupEventHandlers(): void {
        if (!this.client) return;

        this.client.on('connect', () => {
            logger.info('[Redis] Connected successfully');
            this.lastHealthStatus.connected = true;
            this.lastHealthStatus.lastError = null;
        });

        this.client.on('error', (err) => {
            logger.error('[Redis] Connection error', { error: err.message });
            this.lastHealthStatus.connected = false;
            this.lastHealthStatus.lastError = err.message;
        });

        this.client.on('close', () => {
            logger.warn('[Redis] Connection closed');
            this.lastHealthStatus.connected = false;
        });

        this.client.on('reconnecting', () => {
            logger.info('[Redis] Reconnecting...');
        });
    }

    /**
     * Check Redis health with ping.
     */
    async healthCheck(): Promise<RedisHealthStatus> {
        this.lastHealthStatus.lastCheck = new Date();

        const client = this.getClient();
        if (!client) {
            this.lastHealthStatus.connected = false;
            this.lastHealthStatus.latencyMs = null;
            this.lastHealthStatus.lastError = 'No Redis client available';
            return this.lastHealthStatus;
        }

        try {
            const start = Date.now();
            await client.ping();
            const latency = Date.now() - start;

            this.lastHealthStatus.connected = true;
            this.lastHealthStatus.latencyMs = latency;
            this.lastHealthStatus.lastError = null;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.lastHealthStatus.connected = false;
            this.lastHealthStatus.latencyMs = null;
            this.lastHealthStatus.lastError = message;
        }

        return this.lastHealthStatus;
    }

    /**
     * Check if Redis is currently connected.
     */
    isConnected(): boolean {
        return this.client?.status === 'ready';
    }

    /**
     * Get last known health status (without new ping).
     */
    getLastHealthStatus(): RedisHealthStatus {
        return { ...this.lastHealthStatus };
    }

    /**
     * Graceful shutdown.
     */
    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            this.lastHealthStatus.connected = false;
            logger.info('[Redis] Disconnected gracefully');
        }
    }
}

// Export singleton getter
export function getRedisClient(): Redis | null {
    return RedisConnectionManager.getInstance().getClient();
}

export function getRedisManager(): RedisConnectionManager {
    return RedisConnectionManager.getInstance();
}
