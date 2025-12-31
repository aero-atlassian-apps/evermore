import { Session } from '../entities/Session';

export interface SessionRepository {
  create(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  update(session: Session): Promise<void>;
  findByUserId(userId: string, limit?: number): Promise<Session[]>;
  findLastSessions(userId: string, count: number): Promise<Session[]>;
  completeSessionTransaction(sessionId: string): Promise<void>;
}
