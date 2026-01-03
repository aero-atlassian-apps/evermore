import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/rbac-middleware';
import { Permission, UserRole } from '@/lib/auth/roles';
import * as jwt from '@/lib/auth/jwt';

vi.mock('@/lib/auth/jwt', () => ({
    verifySession: vi.fn(),
    verifyPermission: vi.fn(),
}));

describe('RBAC Middleware', () => {
    const mockHandler = vi.fn().mockResolvedValue({ status: 200 });

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should block requests without authorization header', async () => {
        const req = new NextRequest('http://localhost/api/test');
        const middleware = withPermission(Permission.MANAGE_FEATURE_FLAGS, mockHandler);

        const response: any = await middleware(req, { params: {} });
        expect(response.status).toBe(401);
        expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should block requests with invalid tokens', async () => {
        const req = new NextRequest('http://localhost/api/test', {
            headers: { 'Authorization': 'Bearer invalid-token' }
        });
        (jwt.verifySession as any).mockResolvedValue(null);

        const middleware = withPermission(Permission.MANAGE_FEATURE_FLAGS, mockHandler);
        const response: any = await middleware(req, { params: {} });

        expect(response.status).toBe(401);
    });

    it('should block requests with insufficient permissions', async () => {
        const req = new NextRequest('http://localhost/api/test', {
            headers: { 'Authorization': 'Bearer valid-token' }
        });
        (jwt.verifySession as any).mockResolvedValue({ userId: '123', role: UserRole.USER });
        (jwt.verifyPermission as any).mockResolvedValue(false);

        const middleware = withPermission(Permission.MANAGE_FEATURE_FLAGS, mockHandler);
        const response: any = await middleware(req, { params: {} });

        expect(response.status).toBe(403);
    });

    it('should allow requests with correct permissions', async () => {
        const req = new NextRequest('http://localhost/api/test', {
            headers: { 'Authorization': 'Bearer admin-token' }
        });
        const session = { userId: '123', role: UserRole.ADMIN };
        (jwt.verifySession as any).mockResolvedValue(session);
        (jwt.verifyPermission as any).mockResolvedValue(true);

        const middleware = withPermission(Permission.MANAGE_FEATURE_FLAGS, mockHandler);
        await middleware(req, { params: {} });

        expect(mockHandler).toHaveBeenCalledWith(req, expect.objectContaining({ session }));
    });

    it('should allow legacy admin token in development', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('ADMIN_TOKEN', 'test-legacy-token');

        const req = new NextRequest('http://localhost/api/test', {
            headers: { 'x-admin-token': 'test-legacy-token' }
        });

        const middleware = withPermission(Permission.MANAGE_FEATURE_FLAGS, mockHandler);
        await middleware(req, { params: {} });

        expect(mockHandler).toHaveBeenCalled();

        vi.unstubAllEnvs();
    });
});
