import { NextResponse } from 'next/server';

/**
 * Session check endpoint.
 * 
 * Simply returns 200 if the middleware allows the request through
 * (meaning the session cookie is valid), or the middleware will
 * have already returned 401.
 * 
 * This allows client-side code to check auth status since the
 * session cookie is httpOnly and not readable via JavaScript.
 */
export async function GET() {
    // If we get here, middleware has validated the session
    return NextResponse.json({ valid: true }, { status: 200 });
}
