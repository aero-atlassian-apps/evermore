import { SessionRepository } from '../../../core/domain/repositories/SessionRepository';
import { Session } from '../../../core/domain/entities/Session';
import { db } from './index';
import { sessions, jobs } from './schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export class DrizzleSessionRepository implements SessionRepository {
  async create(session: Session): Promise<Session> {
    const [created] = await db.insert(sessions).values({
      id: session.id,
      userId: session.userId,
      status: session.status,
      startedAt: session.startedAt,
      transcriptRaw: session.transcriptRaw
    }).returning();
    return this.mapToEntity(created);
  }

  async findById(id: string): Promise<Session | null> {
    const [found] = await db.select().from(sessions).where(eq(sessions.id, id));
    return found ? this.mapToEntity(found) : null;
  }

  async update(session: Session): Promise<void> {
    console.log('[DrizzleSessionRepository] Updating session:', {
      sessionId: session.id,
      transcriptRawType: typeof session.transcriptRaw,
      transcriptRawIsArray: Array.isArray(session.transcriptRaw),
      transcriptRawLength: Array.isArray(session.transcriptRaw) ? session.transcriptRaw.length :
        (typeof session.transcriptRaw === 'string' ? session.transcriptRaw.length : 0),
    });

    await db.update(sessions).set({
      status: session.status,
      transcriptRaw: session.transcriptRaw,
      endedAt: session.endedAt,
      metadata: session.metadata
    }).where(eq(sessions.id, session.id));

    console.log('[DrizzleSessionRepository] Update complete for session:', session.id);
  }

  async findByUserId(userId: string, limit: number = 2): Promise<Session[]> {
    const found = await db.select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.startedAt))
      .limit(limit);
    return found.map(this.mapToEntity);
  }

  async findLastSessions(userId: string, count: number): Promise<Session[]> {
    return this.findByUserId(userId, count);
  }

  async completeSessionTransaction(sessionId: string): Promise<void> {
    // Transaction: Update Session Status AND Insert Job
    await db.transaction(async (tx) => {
      await tx.update(sessions)
        .set({
          status: 'completed',
          endedAt: new Date()
        })
        .where(eq(sessions.id, sessionId));

      await tx.insert(jobs).values({
        id: randomUUID(),
        type: 'chapter_generation',
        status: 'pending',
        payload: { sessionId },
        createdAt: new Date()
      });
    });
  }

  private mapToEntity(raw: any): Session {
    return new Session(
      raw.id,
      raw.userId,
      raw.transcriptRaw,
      raw.status,
      raw.startedAt,
      raw.audioUrl,
      raw.duration,
      raw.endedAt,
      raw.metadata
    );
  }
}
