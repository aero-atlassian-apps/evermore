import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPad Pro 11'] });

test.describe('Tablet Responsiveness', () => {
    test.setTimeout(30000);

    test('homepage renders on tablet', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        await expect(page).toHaveTitle(/Evermore/);
    });

    test('admin dashboard renders on tablet', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForLoadState('domcontentloaded');

        await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 10000 });
    });
});
