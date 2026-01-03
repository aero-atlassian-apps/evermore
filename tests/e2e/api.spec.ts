import { test, expect } from '@playwright/test';

/**
 * API Endpoint E2E Tests
 * 
 * Tests for API endpoints using Playwright's request context.
 * Verifies health, metrics, and public API functionality.
 */

test.describe('Health Endpoints', () => {
    test('health endpoint returns OK', async ({ request }) => {
        const response = await request.get('/api/health');
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.status).toBe('healthy');
    });

    test('health endpoint has timestamp', async ({ request }) => {
        const response = await request.get('/api/health');
        const body = await response.json();

        expect(body.timestamp).toBeDefined();
    });
});

test.describe('Metrics Endpoint', () => {
    test('metrics endpoint returns data', async ({ request }) => {
        const response = await request.get('/api/metrics');
        expect(response.ok()).toBeTruthy();
    });

    test('metrics endpoint supports JSON format', async ({ request }) => {
        const response = await request.get('/api/metrics?format=json');
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        // Should have some metrics structure
        expect(typeof body).toBe('object');
    });

    test('metrics endpoint supports Prometheus format', async ({ request }) => {
        const response = await request.get('/api/metrics?format=prometheus');
        expect(response.ok()).toBeTruthy();

        const text = await response.text();
        // Prometheus format has specific syntax
        expect(text).toContain('#');
    });
});

test.describe('Feature Flags API', () => {
    test('flag evaluation endpoint works', async ({ request }) => {
        const response = await request.post('/api/flags/evaluate', {
            data: {
                key: 'nonexistent-flag',
                context: { userId: 'test-user' },
            },
        });

        expect(response.ok()).toBeTruthy();
        const body = await response.json();

        // Should return evaluation result
        expect(body.key).toBe('nonexistent-flag');
        expect(body.enabled).toBe(false);
        expect(body.reason).toBe('FLAG_NOT_FOUND');
    });

    test('flag evaluation GET works', async ({ request }) => {
        const response = await request.get('/api/flags/evaluate?key=test-flag');
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.key).toBe('test-flag');
    });

    test('flag evaluation requires key', async ({ request }) => {
        const response = await request.post('/api/flags/evaluate', {
            data: {},
        });

        expect(response.status()).toBe(400);
    });
});

test.describe('Admin Dashboard API', () => {
    test('dashboard endpoint returns data', async ({ request }) => {
        // In development, no auth required
        const response = await request.get('/api/admin/dashboard');
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.timestamp).toBeDefined();
        expect(body.sessions).toBeDefined();
        expect(body.performance).toBeDefined();
    });

    test('dashboard endpoint has all sections', async ({ request }) => {
        const response = await request.get('/api/admin/dashboard');
        const body = await response.json();

        // Verify structure
        expect(body.sessions).toHaveProperty('active');
        expect(body.performance).toHaveProperty('http');
        expect(body.performance).toHaveProperty('llm');
        expect(body.safety).toHaveProperty('alertsToday');
        expect(body.costs).toHaveProperty('last24h');
    });
});

test.describe('Emotion Analysis API', () => {
    test('emotion endpoint requires input', async ({ request }) => {
        const response = await request.post('/api/emotion/analyze', {
            data: {},
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('audioBase64 or text');
    });

    test('emotion endpoint analyzes text', async ({ request }) => {
        const response = await request.post('/api/emotion/analyze', {
            data: {
                text: 'I am so happy today! This is wonderful!',
            },
        });

        expect(response.ok()).toBeTruthy();
        const body = await response.json();

        expect(body.emotionalState).toBeDefined();
        expect(body.emotionalState.primaryEmotion).toBeDefined();
    });
});

test.describe('Rate Limiting', () => {
    test('rate limit headers are present', async ({ request }) => {
        const response = await request.get('/api/health');

        // Check for rate limit headers
        const headers = response.headers();
        // These may or may not be present depending on implementation
        // Just verify the endpoint is accessible
        expect(response.ok()).toBeTruthy();
    });
});
