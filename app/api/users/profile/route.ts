import { NextRequest, NextResponse } from 'next/server';
import { userProfileUpdater } from '@/lib/infrastructure/di/container';
import { logger } from '@/lib/core/application/Logger';
import { UserProfileDTO } from '@/lib/core/dtos/UserProfile';
import { UpdateProfileSchema } from '@/lib/core/application/schemas';

export const dynamic = 'force-dynamic';

// Allowed fields for senior updates (whitelist)
const SENIOR_ALLOWED_FIELDS = [
  // Conversation Preferences
  'conversationSchedule',
  'voiceTone',
  'topicsLove',
  'topicsAvoid',
  'emergencyContact',
  'timezone',
  // Biographical Information (for AI context)
  'birthYear',
  'gender',
  'location',
  'formerOccupation',
  'aboutMe',
  // Family Information
  'spouseName',
  'childrenCount',
  'grandchildrenCount',
  // Memory Context
  'favoriteDecade',
  'significantEvents',
];

// Allowed fields for family updates (whitelist)
const FAMILY_ALLOWED_FIELDS = [
  'seniorId'
];

function sanitizeUpdates(updates: any, allowedFields: string[]) {
  const sanitized: any = {};
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      sanitized[key] = updates[key];
    }
  }
  return sanitized;
}

/**
 * GET /api/users/profile
 * Returns the current user's profile based on the authenticated session.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch full user profile from database
    const user = await userProfileUpdater.getProfile(userId);

    if (user) {
      console.log('🔍 [API DEBUG] User Fetched:', user.id);
      console.log('🔍 [API DEBUG] Prefs Type:', typeof user.preferences);
      console.log('🔍 [API DEBUG] Prefs Content:', JSON.stringify(user.preferences, null, 2));
    }

    if (!user) {
      // User not in DB yet - return minimal profile
      return NextResponse.json({
        userId,
        role: userRole,
        displayName: userRole === 'senior' ? 'Friend' : 'Family Member',
        currentDate: new Date().toISOString(),
        preferences: {},
      });
    }

    // Return full profile with preferences
    const profile: UserProfileDTO = {
      userId: user.id,
      role: user.role,
      displayName: user.name || (userRole === 'senior' ? 'Friend' : 'Family Member'),
      currentDate: new Date().toISOString(),
      seniorId: user.seniorId,
      preferences: user.preferences || {},
    };

    return NextResponse.json(profile);
  } catch (error: any) {
    logger.error('Error fetching profile', { error: error.message });
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Read User ID from the header injected by middleware
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (!userId) {
      // Should be caught by middleware, but double check
      return NextResponse.json({ error: 'Unauthorized: Missing User Context' }, { status: 401 });
    }

    const body = await req.json();
    const result = UpdateProfileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation Failed', details: result.error.flatten() }, { status: 400 });
    }

    const { type, updates } = result.data;
    const targetId = userId;
    let updatedUser;

    if (type === 'senior') {
      if (userRole !== 'senior') {
        return NextResponse.json({ error: 'Forbidden: Role Mismatch' }, { status: 403 });
      }
      updatedUser = await userProfileUpdater.updateSeniorProfile(targetId, updates);
    } else if (type === 'family') {
      if (userRole !== 'family') {
        return NextResponse.json({ error: 'Forbidden: Role Mismatch' }, { status: 403 });
      }
      updatedUser = await userProfileUpdater.updateFamilyProfile(targetId, updates);
    }

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    logger.error('Error updating profile', { error: error.message, userId: req.headers.get('x-user-id') });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
