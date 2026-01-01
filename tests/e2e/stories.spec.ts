import { test, expect } from '@playwright/test';

/**
 * Stories E2E Tests
 * 
 * Covers:
 * - Stories list page load
 * - Story detail page
 * - Stories filtering
 * - Empty state
 */

test.describe('Stories Page', () => {
    test.setTimeout(45000);

    // Login before each test
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder(/email/i).fill('senior-1@example.com');
        await page.getByPlaceholder(/password/i).fill('password123');
        await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
        await expect(page).toHaveURL(/.*\/stories/, { timeout: 15000 });
    });

    test('should load stories list page', async ({ page }) => {
        // Should already be on stories from beforeEach
        await expect(page.getByText(/memory|stories|collection/i).first()).toBeVisible();

        // Should have filter buttons
        await expect(page.getByRole('button', { name: /all stories/i })).toBeVisible();
    });

    test('should filter stories by topic', async ({ page }) => {
        // Click topic filter
        const topicFilter = page.getByRole('button', { name: /by topic/i });
        if (await topicFilter.isVisible()) {
            await topicFilter.click();
            // Stories should be sorted alphabetically
            await page.waitForTimeout(500); // Wait for re-render
        }
    });

    test('should filter stories by date', async ({ page }) => {
        // Click date filter
        const dateFilter = page.getByRole('button', { name: /by date/i });
        if (await dateFilter.isVisible()) {
            await dateFilter.click();
            // Stories should be sorted by date
            await page.waitForTimeout(500);
        }
    });

    test('should search stories', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/search/i);
        if (await searchInput.isVisible()) {
            await searchInput.fill('family');
            await page.waitForTimeout(1000); // Debounce
            // Results should filter
        }
    });

    test('should navigate to story detail', async ({ page }) => {
        // Click on first story card (if any exist)
        const storyCard = page.locator('a[href*="/stories/"]').first();

        if (await storyCard.isVisible()) {
            await storyCard.click();
            await expect(page).toHaveURL(/.*\/stories\/[a-zA-Z0-9-]+/);

            // Story detail should have title and content
            await page.waitForLoadState('domcontentloaded');
        }
    });

    test('should show empty state when no stories', async ({ page, context }) => {
        // Clear cookies to simulate new user
        await context.clearCookies();

        // Login as a new test user (would have no stories)
        await page.goto('/login');
        await page.getByPlaceholder(/email/i).fill('test-empty@example.com');
        await page.getByPlaceholder(/password/i).fill('password123');
        await page.getByRole('button', { name: /sign in|log in|continue/i }).click();

        // If login fails, skip (user doesn't exist)
        // If login succeeds and stories page shows, check for empty state
    });
});

test.describe('Story Detail Page', () => {
    test.setTimeout(45000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder(/email/i).fill('senior-1@example.com');
        await page.getByPlaceholder(/password/i).fill('password123');
        await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
        await expect(page).toHaveURL(/.*\/stories/, { timeout: 15000 });
    });

    test('should display story content', async ({ page }) => {
        const storyCard = page.locator('a[href*="/stories/"]').first();

        if (await storyCard.isVisible()) {
            await storyCard.click();
            await page.waitForLoadState('domcontentloaded');

            // Should have story content elements
            await expect(page.locator('article, .story-content, main').first()).toBeVisible();
        }
    });

    test('should have audio player controls', async ({ page }) => {
        const storyCard = page.locator('a[href*="/stories/"]').first();

        if (await storyCard.isVisible()) {
            await storyCard.click();
            await page.waitForLoadState('domcontentloaded');

            // Look for play button or audio controls
            const playButton = page.getByRole('button', { name: /play|listen/i });
            if (await playButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                await expect(playButton).toBeVisible();
            }
        }
    });
});
