import { test, expect } from '@playwright/test';

/**
 * Core Application E2E Tests
 * 
 * These tests verify basic page rendering without requiring
 * database connections. They test public pages and UI elements.
 */

test.describe('Public Pages', () => {
    test.setTimeout(30000);

    test('homepage loads and has correct title', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Evermore/);
    });

    test('homepage has hero section', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Should have main heading
        await expect(page.locator('h1').first()).toBeVisible();
    });

    test('homepage has CTA button', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Should have "Get Started" or similar CTA
        const cta = page.getByRole('link', { name: /get started|start|begin/i }).first();
        await expect(cta).toBeVisible();
    });

    test('about page loads', async ({ page }) => {
        await page.goto('/about');
        await expect(page).toHaveURL(/.*\/about/);
    });

    test('login page loads', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // Should have login buttons
        await expect(page.getByText(/storyteller|login|welcome/i).first()).toBeVisible();
    });

    test('onboarding page loads', async ({ page }) => {
        await page.goto('/onboarding');
        await expect(page).toHaveURL(/.*\/onboarding/);
    });

    test('contact page loads', async ({ page }) => {
        await page.goto('/contact');
        await expect(page).toHaveURL(/.*\/contact/);
    });

    test('privacy page loads', async ({ page }) => {
        await page.goto('/privacy');
        await expect(page).toHaveURL(/.*\/privacy/);
    });

    test('terms page loads', async ({ page }) => {
        await page.goto('/terms');
        await expect(page).toHaveURL(/.*\/terms/);
    });
});

test.describe('Login Page UI', () => {
    test.setTimeout(30000);

    test('has senior quick login button', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        const seniorButton = page.getByText('The Storyteller');
        await expect(seniorButton).toBeVisible({ timeout: 10000 });
    });

    test('has family quick login button', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        const familyButton = page.getByText('Family Member');
        await expect(familyButton).toBeVisible({ timeout: 10000 });
    });

    test('has email login form', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        const emailInput = page.getByPlaceholder(/email/i);
        await expect(emailInput).toBeVisible();
    });

    test('has link to onboarding', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        const onboardingLink = page.getByText(/start your legacy/i);
        await expect(onboardingLink).toBeVisible();
    });
});

test.describe('Protected Routes Redirect', () => {
    test.setTimeout(30000);

    test('stories page redirects to login when unauthenticated', async ({ page }) => {
        await page.goto('/stories');
        // Should redirect to login
        await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });
    });

    test('conversation page redirects to login when unauthenticated', async ({ page }) => {
        await page.goto('/conversation');
        // Should redirect to login
        await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });
    });

    test('family page redirects to login when unauthenticated', async ({ page }) => {
        await page.goto('/family');
        // Should redirect to login
        await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });
    });
});
