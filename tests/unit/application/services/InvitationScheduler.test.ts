import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvitationScheduler } from '@/lib/core/application/services/InvitationScheduler';
import { UserRepository } from '@/lib/core/domain/repositories/UserRepository';
import { InvitationRepository } from '@/lib/core/domain/repositories/InvitationRepository';
import { User } from '@/lib/core/domain/entities/User';
import { Invitation } from '@/lib/core/domain/entities/Invitation';

describe('InvitationScheduler', () => {
    let service: InvitationScheduler;
    let mockUserRepo: UserRepository;
    let mockInvitationRepo: InvitationRepository;

    beforeEach(() => {
        mockUserRepo = {
            findById: vi.fn(),
            findByEmail: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            findBySeniorId: vi.fn(),
        } as any;

        mockInvitationRepo = {
            create: vi.fn(async (inv) => inv),
            findById: vi.fn(),
            findByToken: vi.fn(),
            update: vi.fn(),
            findPendingBySeniorId: vi.fn(async () => []),
        } as any;

        service = new InvitationScheduler(mockUserRepo, mockInvitationRepo);
    });

    it('should generate an invitation for a matching schedule', async () => {
        // Mock current date: Monday, Jan 1st 2024, 8:00 AM UTC
        // Let's assume user is in UTC for simplicity first.
        const mockNow = new Date('2024-01-01T08:00:00Z');
        vi.useFakeTimers();
        vi.setSystemTime(mockNow);

        const seniorId = 'senior-1';
        const mockUser = new User(seniorId, 'Senior', 'test@test.com', 'senior', undefined, undefined, {
            conversationSchedule: ['Monday 10 AM'],
            timezone: 'UTC'
        });

        vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(mockUser);

        const invitations = await service.generateScheduleForUser(seniorId);

        expect(invitations).toHaveLength(1);
        const inv = invitations[0];
        expect(inv.seniorId).toBe(seniorId);
        // Should be today (Monday) at 10 AM
        expect(inv.scheduledFor.toISOString()).toBe('2024-01-01T10:00:00.000Z');

        vi.useRealTimers();
    });

    it('should handle timezone adjustments (New York)', async () => {
        // Mock current date: Monday, Jan 1st 2024, 12:00 PM UTC
        // New York is UTC-5 (EST)
        // 12:00 PM UTC = 7:00 AM EST (Monday)
        // Schedule: "Monday 10 AM" -> 10:00 AM EST = 15:00 PM UTC
        const mockNow = new Date('2024-01-01T12:00:00Z');
        vi.useFakeTimers();
        vi.setSystemTime(mockNow);

        const seniorId = 'senior-ny';
        const mockUser = new User(seniorId, 'Senior NY', 'ny@test.com', 'senior', undefined, undefined, {
            conversationSchedule: ['Monday 10 AM'],
            timezone: 'America/New_York'
        });

        vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(mockUser);

        const invitations = await service.generateScheduleForUser(seniorId);

        expect(invitations).toHaveLength(1);
        const inv = invitations[0];
        // 10 AM EST = 15:00 UTC
        expect(inv.scheduledFor.toISOString()).toBe('2024-01-01T15:00:00.000Z');

        vi.useRealTimers();
    });

    it('should not create duplicates if invitation exists', async () => {
        const mockNow = new Date('2024-01-01T08:00:00Z');
        vi.useFakeTimers();
        vi.setSystemTime(mockNow);

        const seniorId = 'senior-1';
        const mockUser = new User(seniorId, 'Senior', 'test@test.com', 'senior', undefined, undefined, {
            conversationSchedule: ['Monday 10 AM'],
            timezone: 'UTC'
        });

        vi.spyOn(mockUserRepo, 'findById').mockResolvedValue(mockUser);

        // Mock existing invitation
        const existingInv = new Invitation('inv-1', seniorId, new Date('2024-01-01T10:00:00Z'), 'pending');
        vi.spyOn(mockInvitationRepo, 'findPendingBySeniorId').mockResolvedValue([existingInv]);

        const invitations = await service.generateScheduleForUser(seniorId);

        expect(invitations).toHaveLength(0);
        expect(mockInvitationRepo.create).not.toHaveBeenCalled();

        vi.useRealTimers();
    });
});
