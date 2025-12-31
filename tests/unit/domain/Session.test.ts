import { describe, it, expect } from 'vitest';
import { Session } from '@/lib/core/domain/entities/Session';

describe('Session Entity', () => {
  it('should create a Session instance correctly', () => {
    const now = new Date();
    const session = new Session(
      'session-1',
      'user-1',
      '[]',
      'active',
      now
    );

    expect(session).toBeInstanceOf(Session);
    expect(session.id).toBe('session-1');
    expect(session.status).toBe('active');
    expect(session.startedAt).toBe(now);
  });

  it('should handle optional fields', () => {
    const session = new Session(
      'session-2',
      'user-1',
      '[]',
      'completed',
      new Date(),
      'http://audio.url',
      120,
      new Date(),
      { avg_response_length: 50 }
    );

    expect(session.audioUrl).toBe('http://audio.url');
    expect(session.duration).toBe(120);
    expect(session.metadata?.avg_response_length).toBe(50);
  });
});
