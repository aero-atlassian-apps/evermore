/**
 * LLMGateway Unit Tests
 * 
 * Tests for priority queuing, rate limiting, circuit breaker, and caching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll mock the LLMPort for testing
const mockLLMPort = {
    generateText: vi.fn(),
    generateJson: vi.fn(),
    analyzeImage: vi.fn(),
};

// Test the ThroughputConfig first since it's simpler
describe('ThroughputConfig', () => {
    it('should export RequestTier enum', async () => {
        const { RequestTier } = await import('../../../lib/infrastructure/adapters/ai/ThroughputConfig');
        expect(RequestTier.CRITICAL).toBe(0);
        expect(RequestTier.INTERACTIVE).toBe(1);
        expect(RequestTier.BACKGROUND).toBe(2);
    });

    it('should export TIER_POLICIES for each tier', async () => {
        const { TIER_POLICIES, RequestTier } = await import('../../../lib/infrastructure/adapters/ai/ThroughputConfig');
        expect(TIER_POLICIES[RequestTier.CRITICAL].maxConcurrency).toBe(Infinity);
        expect(TIER_POLICIES[RequestTier.INTERACTIVE].maxConcurrency).toBe(3);
        expect(TIER_POLICIES[RequestTier.BACKGROUND].maxConcurrency).toBe(1);
    });

    it('should export CircuitState enum', async () => {
        const { CircuitState } = await import('../../../lib/infrastructure/adapters/ai/ThroughputConfig');
        expect(CircuitState.CLOSED).toBe('CLOSED');
        expect(CircuitState.OPEN).toBe('OPEN');
        expect(CircuitState.HALF_OPEN).toBe('HALF_OPEN');
    });

    it('should have sensible queue config defaults', async () => {
        const { QUEUE_CONFIG } = await import('../../../lib/infrastructure/adapters/ai/ThroughputConfig');
        expect(QUEUE_CONFIG.maxDepth).toBeGreaterThan(QUEUE_CONFIG.shedTier1Depth);
        expect(QUEUE_CONFIG.shedTier1Depth).toBeGreaterThan(QUEUE_CONFIG.shedTier2Depth);
        expect(QUEUE_CONFIG.shedTier2Depth).toBeGreaterThan(QUEUE_CONFIG.warnDepth);
    });
});

describe('LLMCache', () => {
    it('should cache and retrieve values', async () => {
        const { LLMCache } = await import('../../../lib/infrastructure/adapters/ai/LLMCache');
        const cache = new LLMCache(100);

        const key = cache.hash('test prompt', { prefix: 'test' });
        cache.set(key, 'cached response', 60000);

        expect(cache.get(key)).toBe('cached response');
    });

    it('should expire entries after TTL', async () => {
        const { LLMCache } = await import('../../../lib/infrastructure/adapters/ai/LLMCache');
        const cache = new LLMCache(100);

        const key = cache.hash('test prompt', { prefix: 'test' });
        // Set with 1ms TTL
        cache.set(key, 'cached response', 1);

        // Wait for expiration
        await new Promise(r => setTimeout(r, 10));

        expect(cache.get(key)).toBeNull();
    });

    it('should track hit/miss stats', async () => {
        const { LLMCache } = await import('../../../lib/infrastructure/adapters/ai/LLMCache');
        const cache = new LLMCache(100);

        const key = cache.hash('test', { prefix: 'test' });
        cache.get(key); // Miss
        cache.set(key, 'value', 60000);
        cache.get(key); // Hit
        cache.get(key); // Hit

        const stats = cache.getStats();
        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(1);
    });

    it('should generate consistent hashes for same input', async () => {
        const { LLMCache } = await import('../../../lib/infrastructure/adapters/ai/LLMCache');
        const cache = new LLMCache(100);

        const hash1 = cache.hash('identical prompt', { prefix: 'test' });
        const hash2 = cache.hash('identical prompt', { prefix: 'test' });

        expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different prefixes', async () => {
        const { LLMCache } = await import('../../../lib/infrastructure/adapters/ai/LLMCache');
        const cache = new LLMCache(100);

        const hash1 = cache.hash('prompt', { prefix: 'intent' });
        const hash2 = cache.hash('prompt', { prefix: 'safety' });

        expect(hash1).not.toBe(hash2);
    });
});

describe('LLMGateway', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLLMPort.generateText.mockResolvedValue('mocked response');
        mockLLMPort.generateJson.mockResolvedValue({ result: 'mocked' });
        mockLLMPort.analyzeImage.mockResolvedValue('image analysis');
    });

    it('should pass through to underlying LLM', async () => {
        const { LLMGateway, resetGateway } = await import('../../../lib/infrastructure/adapters/ai/LLMGateway');
        const { RequestTier } = await import('../../../lib/infrastructure/adapters/ai/ThroughputConfig');
        resetGateway();

        const gateway = new LLMGateway(mockLLMPort as any);

        const result = await gateway.generateText(
            'test prompt',
            RequestTier.CRITICAL,
            { purpose: 'test' }
        );

        expect(mockLLMPort.generateText).toHaveBeenCalledWith('test prompt', undefined);
        expect(result).toBe('mocked response');
    });

    it('should track queue status', async () => {
        const { LLMGateway, resetGateway } = await import('../../../lib/infrastructure/adapters/ai/LLMGateway');
        resetGateway();

        const gateway = new LLMGateway(mockLLMPort as any);
        const status = gateway.getQueueStatus();

        expect(status.tier0Depth).toBe(0);
        expect(status.tier1Depth).toBe(0);
        expect(status.tier2Depth).toBe(0);
    });

    it('should report circuit state', async () => {
        const { LLMGateway, resetGateway } = await import('../../../lib/infrastructure/adapters/ai/LLMGateway');
        const { CircuitState } = await import('../../../lib/infrastructure/adapters/ai/ThroughputConfig');
        resetGateway();

        const gateway = new LLMGateway(mockLLMPort as any);
        const state = gateway.getCircuitState();

        expect(state).toBe(CircuitState.CLOSED);
    });

    it('should increment metrics on requests', async () => {
        const { LLMGateway, resetGateway } = await import('../../../lib/infrastructure/adapters/ai/LLMGateway');
        const { RequestTier } = await import('../../../lib/infrastructure/adapters/ai/ThroughputConfig');
        resetGateway();

        const gateway = new LLMGateway(mockLLMPort as any);

        await gateway.generateText('test', RequestTier.CRITICAL, { purpose: 'test' });

        const metrics = gateway.getMetrics();
        expect(metrics.totalRequests).toBeGreaterThan(0);
    });
});
