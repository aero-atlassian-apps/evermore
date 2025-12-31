import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/users/profile/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/infrastructure/di/container', () => ({
  userProfileUpdater: {
    updateSeniorProfile: vi.fn(),
    updateFamilyProfile: vi.fn(),
  },
}));

vi.mock('@/lib/core/application/Logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { userProfileUpdater } from '@/lib/infrastructure/di/container';

describe('POST /api/users/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: any, headers: Record<string, string> = {}) => {
    return new NextRequest('http://localhost:3000/api/users/profile', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: new Headers(headers),
    });
  };

  it('should reject requests without authentication headers', async () => {
    const req = createRequest({ id: 'senior-1', updates: {}, type: 'senior' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should ignore id in body and use header x-user-id', async () => {
    const bodyId = 'senior-2'; // Attacker trying to update victim
    const headerId = 'senior-1'; // Authenticated user
    const updates = { topicsLove: ['Testing'] };

    const req = createRequest(
      { id: bodyId, updates, type: 'senior' },
      { 'x-user-id': headerId, 'x-user-role': 'senior' }
    );

    (userProfileUpdater.updateSeniorProfile as any).mockResolvedValue({ id: headerId, ...updates });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify we called update with the HEADER id, not the BODY id
    expect(userProfileUpdater.updateSeniorProfile).toHaveBeenCalledWith(headerId, expect.anything());
    expect(userProfileUpdater.updateSeniorProfile).not.toHaveBeenCalledWith(bodyId, expect.anything());
  });

  it('should reject role mismatch (Senior trying to update as Family)', async () => {
    const req = createRequest(
      { updates: {}, type: 'family' },
      { 'x-user-id': 'senior-1', 'x-user-role': 'senior' }
    );
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
