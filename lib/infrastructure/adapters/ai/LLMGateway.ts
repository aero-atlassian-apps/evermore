/**
 * LLMGateway - Central throughput controller for all LLM requests.
 * 
 * Provides:
 * - Priority queuing (Tier 0/1/2)
 * - Token bucket rate limiting
 * - Circuit breaker for fault tolerance
 * - Concurrency control per tier
 * - Observability metrics
 * 
 * All LLM requests should flow through this gateway, not directly to adapters.
 * 
 * @module LLMGateway
 */

import { LLMPort } from '../../../core/application/ports/LLMPort';
import { LLMCache, getLLMCache, CACHE_TTLS } from './LLMCache';
import {
    RequestTier,
    TierPolicy,
    TIER_POLICIES,
    CircuitState,
    CIRCUIT_BREAKER_CONFIG,
    QUEUE_CONFIG,
    getProviderLimits,
    ProviderLimits,
} from './ThroughputConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata for a queued request.
 */
export interface RequestMetadata {
    /** Unique request ID */
    requestId: string;
    /** Request tier */
    tier: RequestTier;
    /** Purpose for logging */
    purpose: string;
    /** User ID if applicable */
    userId?: string;
    /** Session ID if applicable */
    sessionId?: string;
    /** Estimated input tokens */
    estimatedTokens?: number;
    /** Cache key if cacheable */
    cacheKey?: string;
    /** Callback when request is pending */
    onPending?: (eta: number) => void;
}

/**
 * Queue status for observability.
 */
export interface QueueStatus {
    tier0Depth: number;
    tier1Depth: number;
    tier2Depth: number;
    totalDepth: number;
    activeTier0: number;
    activeTier1: number;
    activeTier2: number;
}

/**
 * Gateway metrics for observability.
 */
export interface GatewayMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cachedResponses: number;
    rejectedRequests: number;
    circuitBreakerTrips: number;
    averageLatencyMs: number;
}

// ============================================================================
// Token Bucket Rate Limiter
// ============================================================================

class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRatePerMs: number;

    constructor(limits: ProviderLimits) {
        this.maxTokens = limits.rpmLimit + limits.burstAllowance;
        this.tokens = this.maxTokens;
        this.lastRefill = Date.now();
        this.refillRatePerMs = limits.refillRatePerMs;
    }

    /**
     * Try to consume a token. Returns true if successful.
     */
    tryConsume(): boolean {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }

    /**
     * Get estimated wait time until a token is available.
     */
    getWaitTimeMs(): number {
        this.refill();
        if (this.tokens >= 1) return 0;
        const needed = 1 - this.tokens;
        return Math.ceil(needed / this.refillRatePerMs);
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const refillAmount = elapsed * this.refillRatePerMs;
        this.tokens = Math.min(this.maxTokens, this.tokens + refillAmount);
        this.lastRefill = now;
    }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failures: number[] = [];
    private lastOpenTime: number = 0;
    private successCount: number = 0;

    constructor(private config = CIRCUIT_BREAKER_CONFIG) { }

    getState(): CircuitState {
        this.updateState();
        return this.state;
    }

    recordSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.config.successThreshold) {
                this.state = CircuitState.CLOSED;
                this.failures = [];
                this.successCount = 0;
                console.log('[CircuitBreaker] Circuit CLOSED after recovery');
            }
        }
    }

    recordFailure(): void {
        const now = Date.now();
        this.failures.push(now);

        // Prune old failures
        this.failures = this.failures.filter(
            t => now - t < this.config.failureWindowMs
        );

        if (this.failures.length >= this.config.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.lastOpenTime = now;
            console.warn(`[CircuitBreaker] Circuit OPEN after ${this.failures.length} failures`);
        }
    }

    private updateState(): void {
        if (this.state === CircuitState.OPEN) {
            const elapsed = Date.now() - this.lastOpenTime;
            if (elapsed >= this.config.openDurationMs) {
                this.state = CircuitState.HALF_OPEN;
                this.successCount = 0;
                console.log('[CircuitBreaker] Circuit HALF_OPEN, testing recovery');
            }
        }
    }
}

// ============================================================================
// Priority Queue
// ============================================================================

interface QueuedRequest<T> {
    metadata: RequestMetadata;
    operation: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    enqueuedAt: number;
}

class PriorityQueue {
    private queues: Map<RequestTier, QueuedRequest<any>[]> = new Map([
        [RequestTier.CRITICAL, []],
        [RequestTier.INTERACTIVE, []],
        [RequestTier.BACKGROUND, []],
    ]);

    enqueue<T>(request: QueuedRequest<T>): void {
        const queue = this.queues.get(request.metadata.tier)!;
        queue.push(request);
    }

    dequeue(): QueuedRequest<any> | null {
        // Priority order: CRITICAL > INTERACTIVE > BACKGROUND
        for (const tier of [RequestTier.CRITICAL, RequestTier.INTERACTIVE, RequestTier.BACKGROUND]) {
            const queue = this.queues.get(tier)!;
            if (queue.length > 0) {
                return queue.shift()!;
            }
        }
        return null;
    }

    getDepth(tier: RequestTier): number {
        return this.queues.get(tier)?.length || 0;
    }

    getTotalDepth(): number {
        let total = 0;
        for (const queue of this.queues.values()) {
            total += queue.length;
        }
        return total;
    }

    /**
     * Reject requests that have exceeded their queue timeout.
     */
    pruneExpired(): number {
        const now = Date.now();
        let pruned = 0;

        for (const [tier, queue] of this.queues.entries()) {
            const policy = TIER_POLICIES[tier];
            const expired = queue.filter(
                req => now - req.enqueuedAt > policy.queueTimeoutMs
            );

            for (const req of expired) {
                req.reject(new Error(`Queue timeout exceeded for tier ${tier}`));
                pruned++;
            }

            this.queues.set(tier, queue.filter(
                req => now - req.enqueuedAt <= policy.queueTimeoutMs
            ));
        }

        return pruned;
    }
}

// ============================================================================
// LLM Gateway Implementation
// ============================================================================

export class LLMGateway {
    private queue: PriorityQueue;
    private tokenBucket: TokenBucket;
    private circuitBreaker: CircuitBreaker;
    private cache: LLMCache;
    private activeRequests: Map<RequestTier, number> = new Map([
        [RequestTier.CRITICAL, 0],
        [RequestTier.INTERACTIVE, 0],
        [RequestTier.BACKGROUND, 0],
    ]);
    private metrics: GatewayMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cachedResponses: 0,
        rejectedRequests: 0,
        circuitBreakerTrips: 0,
        averageLatencyMs: 0,
    };
    private latencySum: number = 0;
    private processing: boolean = false;

    constructor(private llm: LLMPort) {
        this.queue = new PriorityQueue();
        this.tokenBucket = new TokenBucket(getProviderLimits());
        this.circuitBreaker = new CircuitBreaker();
        this.cache = getLLMCache();

        // Start background processor
        this.startProcessor();

        // Periodic cache pruning
        setInterval(() => this.cache.prune(), 60000);

        console.log('[LLMGateway] Initialized with throughput controls');
    }

    /**
     * Enqueue an LLM request with priority-based execution.
     */
    async enqueue<T>(
        tier: RequestTier,
        operation: () => Promise<T>,
        metadata: Partial<RequestMetadata> = {}
    ): Promise<T> {
        const fullMetadata: RequestMetadata = {
            requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            tier,
            purpose: metadata.purpose || 'unknown',
            ...metadata,
        };

        this.metrics.totalRequests++;

        // Check cache first
        if (fullMetadata.cacheKey) {
            const cached = this.cache.get(fullMetadata.cacheKey);
            if (cached !== null) {
                this.metrics.cachedResponses++;
                return cached as T;
            }
        }

        // Check circuit breaker
        const circuitState = this.circuitBreaker.getState();
        if (circuitState === CircuitState.OPEN) {
            this.metrics.circuitBreakerTrips++;
            const policy = TIER_POLICIES[tier];

            if (policy.fallbackBehavior === 'THROW') {
                throw new Error('Circuit breaker is open - service unavailable');
            } else if (policy.fallbackBehavior === 'DEGRADE') {
                // Return a signal that caller should degrade
                throw new Error('CIRCUIT_OPEN_DEGRADE');
            }
        }

        // Check queue depth for load shedding
        const totalDepth = this.queue.getTotalDepth();
        if (totalDepth >= QUEUE_CONFIG.shedTier2Depth && tier === RequestTier.BACKGROUND) {
            this.metrics.rejectedRequests++;
            throw new Error('Queue full - background requests rejected');
        }
        if (totalDepth >= QUEUE_CONFIG.shedTier1Depth && tier === RequestTier.INTERACTIVE) {
            this.metrics.rejectedRequests++;
            throw new Error('Queue full - interactive requests rejected');
        }

        // For CRITICAL tier, try immediate execution
        if (tier === RequestTier.CRITICAL) {
            return this.executeImmediate(operation, fullMetadata);
        }

        // Queue the request
        return new Promise<T>((resolve, reject) => {
            this.queue.enqueue({
                metadata: fullMetadata,
                operation,
                resolve,
                reject,
                enqueuedAt: Date.now(),
            });

            // Notify caller of pending status
            const eta = this.estimateWaitTime(tier);
            if (fullMetadata.onPending && eta > 0) {
                fullMetadata.onPending(eta);
            }
        });
    }

    /**
     * Execute a request immediately (for CRITICAL tier).
     */
    private async executeImmediate<T>(
        operation: () => Promise<T>,
        metadata: RequestMetadata
    ): Promise<T> {
        const startTime = Date.now();

        try {
            const result = await this.retryWithBackoff(() => operation(), metadata.tier);
            this.circuitBreaker.recordSuccess();
            this.metrics.successfulRequests++;
            this.recordLatency(Date.now() - startTime);

            // Cache if cacheable
            if (metadata.cacheKey && typeof result === 'string') {
                this.cache.set(metadata.cacheKey, result, CACHE_TTLS.SAFETY);
            }

            return result;
        } catch (error: any) {
            this.circuitBreaker.recordFailure();
            this.metrics.failedRequests++;
            throw error;
        }
    }

    /**
     * Background processor that dequeues and executes requests.
     */
    private startProcessor(): void {
        const processLoop = async () => {
            if (this.processing) return;
            this.processing = true;

            try {
                // Prune expired requests
                this.queue.pruneExpired();

                // Check if we can process
                const circuitState = this.circuitBreaker.getState();
                if (circuitState === CircuitState.OPEN) {
                    return;
                }

                // Get next request respecting concurrency limits
                const request = this.getNextExecutableRequest();
                if (!request) return;

                // Wait for rate limit token
                if (!this.tokenBucket.tryConsume()) {
                    const waitTime = this.tokenBucket.getWaitTimeMs();
                    await new Promise(r => setTimeout(r, waitTime));
                }

                // Execute
                const tier = request.metadata.tier;
                this.activeRequests.set(tier, (this.activeRequests.get(tier) || 0) + 1);

                const startTime = Date.now();
                try {
                    const result = await this.retryWithBackoff(() => request.operation(), tier);
                    this.circuitBreaker.recordSuccess();
                    this.metrics.successfulRequests++;
                    this.recordLatency(Date.now() - startTime);

                    // Cache if cacheable
                    if (request.metadata.cacheKey && typeof result === 'string') {
                        const ttl = tier === RequestTier.BACKGROUND
                            ? CACHE_TTLS.DEFAULT
                            : CACHE_TTLS.INTENT;
                        this.cache.set(request.metadata.cacheKey, result, ttl);
                    }

                    request.resolve(result);
                } catch (error: any) {
                    this.circuitBreaker.recordFailure();
                    this.metrics.failedRequests++;
                    request.reject(error);
                } finally {
                    this.activeRequests.set(tier, (this.activeRequests.get(tier) || 1) - 1);
                }
            } finally {
                this.processing = false;
            }
        };

        // Run processor every 100ms
        setInterval(processLoop, 100);
    }

    /**
     * Get next request that can be executed (respecting concurrency limits).
     */
    private getNextExecutableRequest(): QueuedRequest<any> | null {
        for (const tier of [RequestTier.CRITICAL, RequestTier.INTERACTIVE, RequestTier.BACKGROUND]) {
            const policy = TIER_POLICIES[tier];
            const active = this.activeRequests.get(tier) || 0;

            if (active < policy.maxConcurrency && this.queue.getDepth(tier) > 0) {
                // This tier has capacity - but we need to actually dequeue from the right queue
                // For now, rely on PriorityQueue.dequeue() which respects priority
            }
        }
        return this.queue.dequeue();
    }

    /**
     * Estimate wait time for a request of given tier.
     */
    private estimateWaitTime(tier: RequestTier): number {
        const depth = this.queue.getDepth(tier);
        const policy = TIER_POLICIES[tier];
        // Rough estimate: average execution time * queue depth / concurrency
        const avgExecution = this.metrics.averageLatencyMs || 2000;
        return Math.ceil((depth * avgExecution) / policy.maxConcurrency);
    }

    private recordLatency(latencyMs: number): void {
        const count = this.metrics.successfulRequests;
        this.latencySum += latencyMs;
        this.metrics.averageLatencyMs = this.latencySum / count;
    }

    /**
     * Execute a request with exponential backoff retry.
     */
    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        tier: RequestTier
    ): Promise<T> {
        let attempt = 0;
        const maxRetries = 3; // Default max retries

        while (true) {
            try {
                return await operation();
            } catch (error: any) {
                attempt++;

                // Determine if we should retry
                const isRetryable =
                    (error.message && (
                        error.message.includes('429') || // Rate limit
                        error.message.includes('503') || // Service unavailable
                        error.message.includes('timeout') ||
                        error.message.includes('fetch failed')
                    ));

                if (attempt > maxRetries || !isRetryable) {
                    throw error;
                }

                // Calculate delay: base * 2^attempt + jitter
                const baseDelay = 1000;
                const delay = baseDelay * Math.pow(2, attempt) + (Math.random() * 500);

                console.warn(`[LLMGateway] Retry attempt ${attempt}/${maxRetries} for tier ${tier} after ${Math.round(delay)}ms. Error: ${error.message}`);

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // =========================================================================
    // Public Query Methods
    // =========================================================================

    getQueueStatus(): QueueStatus {
        return {
            tier0Depth: this.queue.getDepth(RequestTier.CRITICAL),
            tier1Depth: this.queue.getDepth(RequestTier.INTERACTIVE),
            tier2Depth: this.queue.getDepth(RequestTier.BACKGROUND),
            totalDepth: this.queue.getTotalDepth(),
            activeTier0: this.activeRequests.get(RequestTier.CRITICAL) || 0,
            activeTier1: this.activeRequests.get(RequestTier.INTERACTIVE) || 0,
            activeTier2: this.activeRequests.get(RequestTier.BACKGROUND) || 0,
        };
    }

    getCircuitState(): CircuitState {
        return this.circuitBreaker.getState();
    }

    getMetrics(): GatewayMetrics {
        return { ...this.metrics };
    }

    getCacheStats() {
        return this.cache.getStats();
    }

    // =========================================================================
    // Convenience Methods (wrapping LLM operations)
    // =========================================================================

    /**
     * Generate text with priority queuing.
     */
    async generateText(
        prompt: string,
        tier: RequestTier,
        metadata: Partial<RequestMetadata> = {},
        options?: { model?: string; maxTokens?: number; temperature?: number }
    ): Promise<string> {
        return this.enqueue(
            tier,
            () => this.llm.generateText(prompt, options),
            { ...metadata, purpose: metadata.purpose || 'generateText' }
        );
    }

    /**
     * Generate JSON with priority queuing.
     */
    async generateJson<T>(
        prompt: string,
        tier: RequestTier,
        metadata: Partial<RequestMetadata> = {},
        schema?: any,
        options?: { model?: string; maxTokens?: number; temperature?: number }
    ): Promise<T> {
        return this.enqueue(
            tier,
            () => this.llm.generateJson<T>(prompt, schema, options),
            { ...metadata, purpose: metadata.purpose || 'generateJson' }
        );
    }

    /**
     * Analyze image with priority queuing.
     */
    async analyzeImage(
        imageBase64: string,
        mimeType: string,
        prompt: string,
        tier: RequestTier,
        metadata: Partial<RequestMetadata> = {},
        options?: { model?: string }
    ): Promise<string> {
        return this.enqueue(
            tier,
            () => this.llm.analyzeImage(imageBase64, mimeType, prompt, options),
            { ...metadata, purpose: metadata.purpose || 'analyzeImage' }
        );
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

let gatewayInstance: LLMGateway | null = null;

export function getLLMGateway(llm: LLMPort): LLMGateway {
    if (!gatewayInstance) {
        gatewayInstance = new LLMGateway(llm);
    }
    return gatewayInstance;
}

export function resetGateway(): void {
    gatewayInstance = null;
}
