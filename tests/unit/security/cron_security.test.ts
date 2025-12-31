import { GET } from '@/app/api/cron/process-jobs/route';
import { NextRequest } from 'next/server';
import { expect, test, vi, describe, beforeEach, afterEach } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/infrastructure/di/container', () => ({
  jobRepository: {
    findPending: vi.fn().mockResolvedValue([]), // Return empty to avoid execution
    updateStatus: vi.fn(),
  },
  generateChapterUseCase: {
    execute: vi.fn(),
  },
}));

describe('Cron Job Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should return 401 when CRON_SECRET is undefined, preventing bypass', async () => {
    delete process.env.CRON_SECRET;

    const req = new NextRequest('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer undefined',
      },
    });

    const res = await GET(req);

    // In secure code, this should be 401.
    expect(res.status).toBe(401);
  });

  test('should return 401 when Authorization header is incorrect', async () => {
    process.env.CRON_SECRET = 'secure-secret';

    const req = new NextRequest('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer wrong-secret',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('should return 200 when Authorization header is correct', async () => {
    process.env.CRON_SECRET = 'secure-secret';

    const req = new NextRequest('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer secure-secret',
      },
    });

    const res = await GET(req);
    // Since we mock logic to do nothing, it returns success response
    expect(res.status).toBe(200);
  });
});
