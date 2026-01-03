import { SignJWT, jwtVerify } from 'jose';
import { UserRole, Permission, hasPermission as checkRolePermission } from './roles';

// SECURITY: Environment-aware JWT secret handling
// - Production: MUST have JWT_SECRET env var (min 32 chars) or fails at RUNTIME
// - Development: Falls back to dev secret for local testing
// - Build: Defers validation to prevent build failures
let _key: Uint8Array | null = null;

function getKey(): Uint8Array {
  if (_key) return _key;

  const envSecret = process.env.JWT_SECRET;

  if (!envSecret || envSecret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be defined in production.');
    }
    // Fallback for development only
    return new TextEncoder().encode('legacy-dev-secret-for-evermore-platform');
  }

  _key = new TextEncoder().encode(envSecret);
  return _key;
}

export interface SessionPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export async function signSession(payload: { userId: string; role: UserRole }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Check if a token has a specific permission.
 */
export async function verifyPermission(token: string, permission: Permission): Promise<boolean> {
  const session = await verifySession(token);
  if (!session) return false;
  return checkRolePermission(session.role, permission);
}

