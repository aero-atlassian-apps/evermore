import { UserRepository } from '../../domain/repositories/UserRepository';
import { InvitationRepository } from '../../domain/repositories/InvitationRepository';
import { Invitation } from '../../domain/entities/Invitation';
import { randomUUID } from 'crypto';

export class InvitationScheduler {
  constructor(
    private userRepository: UserRepository,
    private invitationRepository: InvitationRepository
  ) {}

  async generateScheduleForUser(userId: string): Promise<Invitation[]> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.role !== 'senior') {
      throw new Error('Invalid senior user');
    }

    const preferences = user.preferences;
    if (
      !preferences?.conversationSchedule ||
      preferences.conversationSchedule.length === 0
    ) {
      return [];
    }

    const createdInvitations: Invitation[] = [];
    const now = new Date();
    const timezone = preferences.timezone || 'UTC';

    for (let i = 0; i < 7; i++) {
      const futureDate = new Date(now);
      futureDate.setDate(now.getDate() + i);

      // Get the day name in the user's timezone
      const dayName = futureDate.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: timezone,
      });

      for (const scheduleStr of preferences.conversationSchedule) {
        // scheduleStr format: "Monday 10 AM"
        const [schedDay, schedTime, schedAmpm] = scheduleStr.split(' ');

        if (schedDay === dayName) {
          // Calculate target hour in 24h format
          const hour = parseInt(schedTime);
          const isPm = schedAmpm === 'PM';
          const hour24 =
            isPm && hour !== 12 ? hour + 12 : hour === 12 && !isPm ? 0 : hour;

          // Construct the target date
          // Start with the future date (correct day)
          const scheduledDate = new Date(futureDate);
          scheduledDate.setUTCHours(hour24, 0, 0, 0);

          // Converge to correct time in user's timezone
          // This is an iterative approximation to handle timezone offsets
          const formatOptions: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            hour: 'numeric',
            hour12: false,
          };

          for (let k = 0; k < 3; k++) {
            const parts = new Intl.DateTimeFormat('en-US', {
              ...formatOptions,
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              minute: 'numeric',
            }).formatToParts(scheduledDate);
            const p = (type: string) => parts.find((x) => x.type === type)?.value;

            const currentTzHour = parseInt(p('hour') || '0');
            const diffHours = hour24 - currentTzHour;

            if (diffHours === 0) break;

            scheduledDate.setTime(
              scheduledDate.getTime() + diffHours * 60 * 60 * 1000
            );
          }

          // Check for duplicate pending invitations
          const pending = await this.invitationRepository.findPendingBySeniorId(
            userId
          );
          const existing = pending.find(
            (inv) =>
              Math.abs(inv.scheduledFor.getTime() - scheduledDate.getTime()) <
              60000
          ); // 1 minute tolerance

          if (!existing) {
            const invitation = new Invitation(
              randomUUID(),
              userId,
              scheduledDate,
              'pending',
              undefined,
              false,
              { origin: 'automated_schedule' }
            );

            const created = await this.invitationRepository.create(invitation);
            createdInvitations.push(created);
          }
        }
      }
    }

    return createdInvitations;
  }
}
