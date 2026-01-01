import { createUserUseCase } from '@/lib/infrastructure/di/container';
import { NextResponse } from 'next/server';
import { recordHttpRequest } from '@/lib/core/application/observability/Metrics';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/core/application/security/RateLimiter';
import { logger } from '@/lib/core/application/Logger';
import { UserCreateSchema } from '@/lib/core/application/schemas';

export async function POST(req: Request) {
  const reqStart = Date.now();
  let statusCode = 201;
  try {
    const traceId = (req as any).headers?.get?.('x-trace-id') || crypto.randomUUID();
    const rate = checkRateLimit(req as any, RATE_LIMIT_PRESETS.standard);
    if (!rate.success) {
      statusCode = 429;
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429, headers: rate.retryAfterSeconds ? new Headers({ 'Retry-After': String(rate.retryAfterSeconds) }) : undefined });
    }
    const body = await req.json();

    // Validation
    const result = UserCreateSchema.safeParse(body);
    if (!result.success) {
      statusCode = 400;
      return NextResponse.json(
        { error: 'Validation Failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const user = await createUserUseCase.execute(result.data);

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    logger.error('Error creating user', { error: (error as any)?.message || String(error) });
    statusCode = 500;
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  } finally {
    try {
      recordHttpRequest('POST', '/api/users', statusCode, Date.now() - reqStart);
    } catch {
      // no-op
    }
  }
}
