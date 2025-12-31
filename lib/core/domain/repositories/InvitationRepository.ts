import { Invitation } from '../entities/Invitation';

export interface InvitationRepository {
  create(invitation: Invitation): Promise<Invitation>;
  findById(id: string): Promise<Invitation | null>;
  findBySeniorId(seniorId: string): Promise<Invitation[]>;
  findPendingBySeniorId(seniorId: string): Promise<Invitation[]>;
  update(invitation: Invitation): Promise<Invitation>;
}
