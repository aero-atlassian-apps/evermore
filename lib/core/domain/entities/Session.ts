import { Message } from '../value-objects/Message';
export type SessionStatus = 'active' | 'completed' | 'failed';

export interface Alert {
  timestamp: string;
  severity: string;
  reason: string;
  message: string;
}

export interface SessionMetadata {
  strategy_usage?: { [key: string]: number };
  avg_response_length?: number;
  sentiment_distribution?: { [key: string]: number };
  alerts?: Alert[];
  [key: string]: any; // Allow extensibility
}

export class Session {
  constructor(
    public id: string,
    public userId: string,
    public transcriptRaw: Message[] | any, // JSON object/array (from DB jsonb)
    public status: SessionStatus,
    public startedAt: Date,
    public audioUrl?: string,
    public duration?: number,
    public endedAt?: Date,
    public metadata: SessionMetadata = {}
  ) { }

  addAlert(severity: string, reason: string, message: string): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    if (!this.metadata.alerts) {
      this.metadata.alerts = [];
    }
    this.metadata.alerts.push({
      timestamp: new Date().toISOString(),
      severity,
      reason,
      message,
    });
  }
}
