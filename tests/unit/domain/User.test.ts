import { describe, it, expect } from 'vitest';
import { User } from '@/lib/core/domain/entities/User';

describe('User Entity', () => {
  it('should create a User instance correctly', () => {
    const user = new User(
      'user-1',
      'John Doe',
      'john@example.com',
      'senior',
      undefined,
      '+1234567890',
      { voiceTone: 'warm' },
      new Date(),
      new Date()
    );

    expect(user).toBeInstanceOf(User);
    expect(user.id).toBe('user-1');
    expect(user.role).toBe('senior');
    expect(user.preferences?.voiceTone).toBe('warm');
  });

  it('should allow optional fields to be undefined', () => {
    const user = new User('user-2', 'Jane Doe', 'jane@example.com', 'family');

    expect(user.seniorId).toBeUndefined();
    expect(user.phoneNumber).toBeUndefined();
    expect(user.preferences).toBeUndefined();
  });
});
