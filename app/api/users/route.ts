import { createUserUseCase } from '@/lib/infrastructure/di/container';
import { NextResponse } from 'next/server';
import { UserCreateSchema } from '@/lib/core/application/schemas';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validation
    const result = UserCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation Failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const user = await createUserUseCase.execute(result.data);

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
