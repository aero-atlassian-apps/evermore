export type AlertType = 'crisis' | 'decline';
export type AlertSeverity = 'high' | 'low';

export class Alert {
  constructor(
    public id: string,
    public seniorId: string,
    public sessionId: string | null | undefined,
    public type: AlertType,
    public content: string,
    public severity: AlertSeverity,
    public triggerPhrase?: string,
    public acknowledged?: boolean,
    public createdAt?: Date
  ) {}
}
