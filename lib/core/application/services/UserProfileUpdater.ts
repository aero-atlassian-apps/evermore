import { UserRepository } from '../../domain/repositories/UserRepository';
import { User } from '../../domain/entities/User';

export class UserProfileUpdater {
  constructor(private userRepository: UserRepository) {}

  async updateSeniorProfile(
    id: string,
    updates: Partial<NonNullable<User['preferences']>>
  ): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'senior') {
      throw new Error('Can only update profile for senior users');
    }

    const updatedPreferences = {
      ...user.preferences,
      ...updates,
    };

    user.preferences = updatedPreferences;

    return await this.userRepository.update(user);
  }

  async getProfile(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async updateFamilyProfile(
    id: string,
    updates: { seniorId?: string }
  ): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'family') {
      throw new Error('Can only update profile for family users');
    }

    if (updates.seniorId) {
      user.seniorId = updates.seniorId;
    }

    return await this.userRepository.update(user);
  }
}
