import { UserRepository } from '../../../core/domain/repositories/UserRepository';
import { User } from '../../../core/domain/entities/User';
import { SeniorPreferencesSchema, FamilyPreferencesSchema } from '../../../core/application/schemas';
import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';

export class DrizzleUserRepository implements UserRepository {
  async create(user: User): Promise<User> {
    this.validatePreferences(user.role, user.preferences);

    const [created] = await db.insert(users).values({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      seniorId: user.seniorId,
      phoneNumber: user.phoneNumber,
      preferences: user.preferences
    }).returning();

    return this.mapToEntity(created);
  }

  async findById(id: string): Promise<User | null> {
    const [found] = await db.select().from(users).where(eq(users.id, id));
    return found ? this.mapToEntity(found) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [found] = await db.select().from(users).where(eq(users.email, email));
    return found ? this.mapToEntity(found) : null;
  }

  async update(user: User): Promise<User> {
    this.validatePreferences(user.role, user.preferences);

    const [updated] = await db.update(users)
      .set({
        name: user.name,
        email: user.email,
        role: user.role,
        seniorId: user.seniorId,
        phoneNumber: user.phoneNumber,
        preferences: user.preferences,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))
      .returning();

    return this.mapToEntity(updated);
  }

  private mapToEntity(raw: any): User {
    return new User(
      raw.id,
      raw.name,
      raw.email,
      raw.role,
      raw.seniorId,
      raw.phoneNumber,
      raw.preferences,
      raw.createdAt,
      raw.updatedAt
    );
  }

  private validatePreferences(role: string, preferences: any): void {
    // Skip validation if preferences is undefined (new user)
    if (!preferences) return;

    // DB Integrity Check: Enforce Schema on JSONB Column
    if (role === 'senior') {
      const result = SeniorPreferencesSchema.safeParse(preferences);
      if (!result.success) throw new Error(`DB Integrity Violation: Invalid Senior Preferences - ${JSON.stringify(result.error.flatten())}`);
    } else if (role === 'family') {
      const result = FamilyPreferencesSchema.safeParse(preferences);
      if (!result.success) throw new Error(`DB Integrity Violation: Invalid Family Preferences - ${JSON.stringify(result.error.flatten())}`);
    }
  }

}
