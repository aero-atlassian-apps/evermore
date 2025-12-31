
import { z } from 'zod';

export const UserRoleSchema = z.enum(['senior', 'family']);

export const UserCreateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    role: UserRoleSchema,
    seniorId: z.string().uuid("Invalid Senior ID").optional(),
    phoneNumber: z.string().optional(),
});

export const LoginSchema = z.object({
    email: z.preprocess(val => val === '' ? undefined : val, z.string().email().optional()),
    userId: z.preprocess(val => val === '' ? undefined : val, z.string().optional()),
    role: z.preprocess(val => val === '' ? undefined : val, UserRoleSchema.optional()),
}).refine(data => {
    // Either email is present OR (userId AND role) are present
    return !!data.email || (!!data.userId && !!data.role);
}, {
    message: "Must provide either 'email' OR ('userId' and 'role')",
});

// Update Profile Schemas
export const SeniorPreferencesSchema = z.object({
    // Conversation Preferences
    conversationSchedule: z.array(z.string()).optional(),
    voiceTone: z.string().optional(),
    topicsLove: z.array(z.string()).optional(),
    topicsAvoid: z.array(z.string()).optional(),
    emergencyContact: z.object({
        name: z.string().min(1, "Contact name required"),
        phoneNumber: z.string().min(1, "Phone number required"),
        email: z.string().email().optional(),
        relationship: z.string().optional()
    }).optional(),
    timezone: z.string().optional(),
    favoriteChapterIds: z.array(z.string()).optional(),

    // Biographical Information
    birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    location: z.string().optional(),
    formerOccupation: z.string().optional(),
    aboutMe: z.string().optional(),

    // Family Information
    spouseName: z.string().optional(),
    childrenCount: z.number().int().min(0).optional(),
    grandchildrenCount: z.number().int().min(0).optional(),

    // Memory Context
    favoriteDecade: z.string().optional(),
    significantEvents: z.array(z.string()).optional(),
});

export const FamilyPreferencesSchema = z.object({
    seniorId: z.string().uuid("Invalid Senior ID").optional(),
    favoriteChapterIds: z.array(z.string()).optional()
});

export const UpdateProfileSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('senior'),
        updates: SeniorPreferencesSchema
    }),
    z.object({
        type: z.literal('family'),
        updates: FamilyPreferencesSchema
    })
]);
