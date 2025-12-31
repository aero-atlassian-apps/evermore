export type InvitationStatus = 'pending' | 'sent' | 'answered' | 'missed' | 'cancelled';

export class Invitation {
  constructor(
    public id: string,
    public seniorId: string,
    public scheduledFor: Date,
    public status: InvitationStatus,
    public sentAt?: Date,
    public reminderSent?: boolean,
    public metadata?: Record<string, any>,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {}
}
