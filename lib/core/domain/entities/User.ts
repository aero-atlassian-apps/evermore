export type UserRole = 'senior' | 'family';

export class User {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public role: UserRole,
    public seniorId?: string,
    public phoneNumber?: string,
    public preferences?: {
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
      favoriteChapterIds?: string[]; // IDs of favorited chapters

      // Biographical
      aboutMe?: string;
      birthYear?: number;
      gender?: 'male' | 'female' | 'other';
      location?: string;
      formerOccupation?: string;

      // Family
      spouseName?: string;
      childrenCount?: number;
      grandchildrenCount?: number;

      // Memory Context
      favoriteDecade?: string;
      significantEvents?: string[];
    },
    public createdAt?: Date,
    public updatedAt?: Date
  ) { }
}
