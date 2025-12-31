import { SignJWT, jwtVerify } from 'jose';

// SECURITY: Environment-aware JWT secret handling
// - Production: MUST have JWT_SECRET env var (min 32 chars) or fails at RUNTIME
// - Development: Falls back to dev secret for local testing
// - Build: Defers validation to prevent build failures
let _key: Uint8Array | null = null;

function getKey(): Uint8Array {
  if (_key) return _key;

  const envSecret = process.env.JWT_SECRET;

  if (!envSecret || envSecret.length < 32) {
    throw new Error('JWT_SECRET must be defined in environment and be at least 32 characters long.');
  }

  _key = new TextEncoder().encode(envSecret);
  return _key;
}

export async function signSession(payload: { userId: string; role: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getKey());
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getKey());
    return payload as { userId: string; role: string };
  } catch (error) {
    return null;
  }
}

