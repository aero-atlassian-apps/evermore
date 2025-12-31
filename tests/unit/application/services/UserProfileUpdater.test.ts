import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserProfileUpdater } from '@/lib/core/application/services/UserProfileUpdater';
import { UserRepository } from '@/lib/core/domain/repositories/UserRepository';
import { User } from '@/lib/core/domain/entities/User';

describe('UserProfileUpdater', () => {
    let service: UserProfileUpdater;
    let mockUserRepo: UserRepository;

    beforeEach(() => {
        mockUserRepo = {
            findById: vi.fn(),
            findByEmail: vi.fn(),
            create: vi.fn(),
            update: vi.fn(async (u) => u),
            findBySeniorId: vi.fn(),
        } as any;
        service = new UserProfileUpdater(mockUserRepo);
    });

    it('should update senior preferences', async () => {
        const user = new User('u-1', 'Senior', 's@t.com', 'senior', undefined, undefined, { voiceTone: 'neutral' });
        vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(user);

        const updated = await service.updateSeniorProfile('u-1', { voiceTone: 'warm' });

        expect(updated.preferences?.voiceTone).toBe('warm');
        expect(mockUserRepo.update).toHaveBeenCalled();
    });

    it('should throw if updating non-senior as senior', async () => {
        const user = new User('u-2', 'Family', 'f@t.com', 'family');
        vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(user);

        await expect(service.updateSeniorProfile('u-2', { voiceTone: 'warm' }))
            .rejects.toThrow('Can only update profile for senior users');
    });

    it('should update family profile', async () => {
        const user = new User('u-3', 'Family', 'f@t.com', 'family');
        vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(user);

        const updated = await service.updateFamilyProfile('u-3', { seniorId: 's-1' });

        expect(updated.seniorId).toBe('s-1');
        expect(mockUserRepo.update).toHaveBeenCalled();
    });
});
