import { Job, JobRepository } from '../../../core/domain/repositories/JobRepository';
import { db } from './index';
import { jobs } from './schema';
import { eq, and, asc } from 'drizzle-orm';

export class DrizzleJobRepository implements JobRepository {
    async create(type: string, payload: any): Promise<Job> {
        const [created] = await db.insert(jobs).values({
            type,
            status: 'pending',
            payload
        }).returning();
        return this.mapToEntity(created);
    }

    async findById(id: string): Promise<Job | null> {
        const [found] = await db.select().from(jobs).where(eq(jobs.id, id));
        return found ? this.mapToEntity(found) : null;
    }

    async findPending(type?: string, limit: number = 10): Promise<Job[]> {
        const query = db.select().from(jobs)
            .where(and(
                eq(jobs.status, 'pending'),
                type ? eq(jobs.type, type) : undefined
            ))
            .orderBy(asc(jobs.createdAt))
            .limit(limit);

        const found = await query;
        return found.map(this.mapToEntity);
    }

    async updateStatus(id: string, status: Job['status'], result?: any, error?: string, updatedPayload?: any): Promise<Job> {
        const updates: any = { status };
        if (status === 'processing') updates.startedAt = new Date();
        if (status === 'completed' || status === 'failed') updates.completedAt = new Date();
        if (result) updates.result = result;
        if (error) updates.error = error;
        if (updatedPayload) updates.payload = updatedPayload;

        const [updated] = await db.update(jobs)
            .set(updates)
            .where(eq(jobs.id, id))
            .returning();

        return this.mapToEntity(updated);
    }

    private mapToEntity(raw: any): Job {
        return {
            id: raw.id,
            type: raw.type,
            status: raw.status as any,
            payload: raw.payload,
            result: raw.result,
            error: raw.error,
            createdAt: raw.createdAt,
            startedAt: raw.startedAt,
            completedAt: raw.completedAt
        };
    }
}
