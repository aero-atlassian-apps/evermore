import { InvitationRepository } from '../../../core/domain/repositories/InvitationRepository';
import { Invitation, InvitationStatus } from '../../../core/domain/entities/Invitation';
import { db } from './index';
import { invitations } from './schema';
import { eq, and } from 'drizzle-orm';

export class DrizzleInvitationRepository implements InvitationRepository {
  async create(invitation: Invitation): Promise<Invitation> {
    const [created] = await db.insert(invitations).values({
      id: invitation.id,
      seniorId: invitation.seniorId,
      scheduledFor: invitation.scheduledFor,
      status: invitation.status,
      sentAt: invitation.sentAt,
      reminderSent: invitation.reminderSent,
      metadata: invitation.metadata
    }).returning();

    return this.mapToEntity(created);
  }

  async findById(id: string): Promise<Invitation | null> {
    const [found] = await db.select().from(invitations).where(eq(invitations.id, id));
    return found ? this.mapToEntity(found) : null;
  }

  async findBySeniorId(seniorId: string): Promise<Invitation[]> {
    const found = await db.select().from(invitations).where(eq(invitations.seniorId, seniorId));
    return found.map(this.mapToEntity);
  }

  async findPendingBySeniorId(seniorId: string): Promise<Invitation[]> {
    const found = await db.select().from(invitations).where(
      and(
        eq(invitations.seniorId, seniorId),
        eq(invitations.status, 'pending')
      )
    );
    return found.map(this.mapToEntity);
  }

  async update(invitation: Invitation): Promise<Invitation> {
    const [updated] = await db.update(invitations)
      .set({
        scheduledFor: invitation.scheduledFor,
        status: invitation.status,
        sentAt: invitation.sentAt,
        reminderSent: invitation.reminderSent,
        metadata: invitation.metadata,
        updatedAt: new Date()
      })
      .where(eq(invitations.id, invitation.id))
      .returning();

    return this.mapToEntity(updated);
  }

  private mapToEntity(raw: any): Invitation {
    return new Invitation(
      raw.id,
      raw.seniorId,
      raw.scheduledFor,
      raw.status as InvitationStatus,
      raw.sentAt,
      raw.reminderSent,
      raw.metadata,
      raw.createdAt,
      raw.updatedAt
    );
  }
}
