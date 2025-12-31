import { UserRepository } from '../../domain/repositories/UserRepository';
import { User } from '../../domain/entities/User';
import { randomUUID } from 'crypto';

export class CreateUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async execute(data: { name: string; email: string; role: 'senior' | 'family'; seniorId?: string; phoneNumber?: string }): Promise<User> {
    const user = new User(
        randomUUID(),
        data.name,
        data.email,
        data.role,
        data.seniorId,
        data.phoneNumber
    );
    return this.userRepository.create(user);
  }
}
