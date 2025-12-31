import { AlertRepository } from '../../../core/domain/repositories/AlertRepository';
import { Alert, AlertType, AlertSeverity } from '../../../core/domain/entities/Alert';
import { db } from './index';
import { alerts } from './schema';
import { eq, and } from 'drizzle-orm';

export class DrizzleAlertRepository implements AlertRepository {
  async create(alert: Alert): Promise<Alert> {
    const [created] = await db.insert(alerts).values({
      id: alert.id,
      seniorId: alert.seniorId,
      sessionId: alert.sessionId,
      type: alert.type,
      content: alert.content,
      triggerPhrase: alert.triggerPhrase,
      severity: alert.severity,
      acknowledged: alert.acknowledged
    }).returning();

    return this.mapToEntity(created);
  }

  async findBySeniorId(seniorId: string): Promise<Alert[]> {
    const found = await db.select().from(alerts).where(eq(alerts.seniorId, seniorId));
    return found.map(this.mapToEntity);
  }

  async findUnacknowledged(seniorId: string): Promise<Alert[]> {
    const found = await db.select().from(alerts).where(
      and(
        eq(alerts.seniorId, seniorId),
        eq(alerts.acknowledged, false)
      )
    );
    return found.map(this.mapToEntity);
  }

  async update(alert: Alert): Promise<Alert> {
    const [updated] = await db.update(alerts)
      .set({
        acknowledged: alert.acknowledged,
      })
      .where(eq(alerts.id, alert.id))
      .returning();

    return this.mapToEntity(updated);
  }

  private mapToEntity(raw: any): Alert {
    return new Alert(
      raw.id,
      raw.seniorId,
      raw.sessionId,
      raw.type as AlertType,
      raw.content,
      raw.severity as AlertSeverity,
      raw.triggerPhrase,
      raw.acknowledged,
      raw.createdAt
    );
  }
}
