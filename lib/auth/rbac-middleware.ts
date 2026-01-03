import { NextRequest, NextResponse } from 'next/server';
import { verifySession, verifyPermission, SessionPayload } from './jwt';
import { Permission, UserRole } from './roles';

/**
 * Enhanced Next.js handler with RBAC context.
 */
export type AuthenticatedContext = {
    params: any;
    session: SessionPayload;
};

export type AuthenticatedHandler = (
    req: NextRequest,
    ctx: AuthenticatedContext
) => Promise<NextResponse> | NextResponse;

/**
 * Middleware wrapper to enforce permission-based access control.
 */
export function withPermission(permission: Permission, handler: AuthenticatedHandler) {
    return async (req: NextRequest, { params }: { params: any }) => {
        const authHeader = req.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Check for legacy admin token to support transition (DEPRECATED)
            const legacyToken = req.headers.get('x-admin-token');
            if (legacyToken === process.env.ADMIN_TOKEN && process.env.NODE_ENV !== 'production') {
                const mockSession: SessionPayload = { userId: 'legacy-admin', role: UserRole.SUPER_ADMIN };
                return handler(req, { params, session: mockSession });
            }

            return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const session = await verifySession(token);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized: Session expired or invalid' }, { status: 401 });
        }

        const allowed = await verifyPermission(token, permission);
        if (!allowed) {
            return NextResponse.json({
                error: 'Forbidden: Insufficient permissions',
                required: permission
            }, { status: 403 });
        }

        return handler(req, { params, session });
    };
}

/**
 * Simple role-based shorthand.
 */
export function withRole(role: UserRole, handler: AuthenticatedHandler) {
    return async (req: NextRequest, { params }: { params: any }) => {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const session = await verifySession(token);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if session role is at least as high as required role
        // For simplicity, we just check equality or if it's SUPER_ADMIN
        const isAllowed = session.role === role || session.role === UserRole.SUPER_ADMIN;

        if (!isAllowed) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return handler(req, { params, session });
    };
}
