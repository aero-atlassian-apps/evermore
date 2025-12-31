import { NextRequest, NextResponse } from 'next/server';
import { userRepository, chapterRepository } from '@/lib/infrastructure/di/container';
import { userProfileUpdater } from '@/lib/infrastructure/di/container'; // Reuse updater if available context
import { logger } from '@/lib/core/application/Logger';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const chapterId = (await params).id;
        const userId = req.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify chapter exists
        const chapter = await chapterRepository.findById(chapterId);
        if (!chapter) {
            return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }

        // Get current user profile
        const user = await userRepository.findById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const currentFavorites = user.preferences?.favoriteChapterIds || [];
        const isFavorite = currentFavorites.includes(chapterId);

        let newFavorites: string[];
        let action: 'added' | 'removed';

        if (isFavorite) {
            newFavorites = currentFavorites.filter(id => id !== chapterId);
            action = 'removed';
        } else {
            newFavorites = [...currentFavorites, chapterId];
            action = 'added';
        }

        // Update user preferences
        // We use userRepository.update here. Ideally should use a specific use case but this is simple.
        // However, User entity logic is best.

        // Update user preferences locally
        const updatedPreferences = {
            ...user.preferences,
            favoriteChapterIds: newFavorites
        };

        // Mutate the user entity (or create new instance if preferred, but mutation is safe here as it's a DTO/Entity)
        // We must ensure the 'user' object is valid for the update method which expects a User entity
        user.preferences = updatedPreferences;

        await userRepository.update(user);

        return NextResponse.json({
            success: true,
            action,
            isFavorite: !isFavorite
        });

    } catch (error: any) {
        logger.error('Error toggling favorite', { error: error.message });
        return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 });
    }
}
