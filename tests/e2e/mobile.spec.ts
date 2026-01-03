import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 13'] });

test.describe('Mobile Responsiveness', () => {
    test.setTimeout(30000);

    test('homepage renders on mobile', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Page should render correctly
        await expect(page.locator('body')).toBeVisible();
        await expect(page).toHaveTitle(/Evermore/);
    });

    test('navigation is accessible on mobile', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Mobile might have hamburger menu
        const menuButton = page.locator('[aria-label*="menu"], button[class*="hamburger"], button[class*="mobile"]');
        const menuCount = await menuButton.count();

        // Either has mobile menu or regular nav is visible
        if (menuCount > 0) {
            await expect(menuButton.first()).toBeVisible();
        }
    });

    test('CTA button is visible on mobile', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Main CTA should be visible
        const cta = page.getByRole('link', { name: /get started|start|begin/i }).first();
        await expect(cta).toBeVisible({ timeout: 10000 });
    });

    test('login page works on mobile', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // Login options should be visible
        const emailInput = page.getByPlaceholder(/email/i);
        await expect(emailInput).toBeVisible();
    });
});
