
export interface UserProfileDTO {
    userId: string;
    role: 'senior' | 'family';
    displayName: string;
    seniorId?: string;
    currentDate?: string;
    email?: string;
    preferences: {
        // Conversation Preferences
        conversationSchedule?: string[];
        voiceTone?: string;
        topicsLove?: string[];
        topicsAvoid?: string[];
        emergencyContact?: {
            name: string;
            phoneNumber: string;
            email?: string;
            relationship?: string;
        };
        timezone?: string;
        favoriteChapterIds?: string[];

        // Biographical Information
        birthYear?: number;
        gender?: 'male' | 'female' | 'other';
        location?: string;
        formerOccupation?: string;
        aboutMe?: string;

        // Family Information
        spouseName?: string;
        childrenCount?: number;
        grandchildrenCount?: number;

        // Memory Context
        favoriteDecade?: string;
        significantEvents?: string[];
    };
}
