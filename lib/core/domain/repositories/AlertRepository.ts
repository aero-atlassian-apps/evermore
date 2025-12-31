import { Alert } from '../entities/Alert';

export interface AlertRepository {
  create(alert: Alert): Promise<Alert>;
  findBySeniorId(seniorId: string): Promise<Alert[]>;
  findUnacknowledged(seniorId: string): Promise<Alert[]>;
  update(alert: Alert): Promise<Alert>;
}
