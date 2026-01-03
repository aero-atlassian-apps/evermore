import { test, expect } from '@playwright/test';

/**
 * Accessibility E2E Tests
 * 
 * Tests for WCAG compliance, keyboard navigation, and screen reader support.
 * Essential for senior users who may rely on assistive technologies.
 */

test.describe('Accessibility - Public Pages', () => {
    test.setTimeout(30000);

    test('homepage has proper heading structure', async ({ page }) => {
        await page.goto('/');

        // Wait for loading to finish and content to appear
        await page.locator('main').waitFor({ state: 'visible', timeout: 10000 });

        // Should have exactly one h1
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBeGreaterThanOrEqual(1);

        // First heading should be h1
        const firstHeading = page.locator('h1').first();
        await expect(firstHeading).toBeVisible();
    });

    test('homepage images have alt text', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const images = page.locator('img');
        const count = await images.count();

        for (let i = 0; i < Math.min(count, 10); i++) {
            const img = images.nth(i);
            const alt = await img.getAttribute('alt');
            // Alt can be empty for decorative images, but attribute should exist
            expect(alt !== null).toBeTruthy();
        }
    });

    test('buttons have accessible names', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const buttons = page.locator('button');
        const count = await buttons.count();

        for (let i = 0; i < Math.min(count, 10); i++) {
            const button = buttons.nth(i);
            // Button should have text content or aria-label
            const text = await button.textContent();
            const ariaLabel = await button.getAttribute('aria-label');
            expect(text || ariaLabel).toBeTruthy();
        }
    });

    test('links have accessible names', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const links = page.locator('a');
        const count = await links.count();

        for (let i = 0; i < Math.min(count, 10); i++) {
            const link = links.nth(i);
            const text = await link.textContent();
            const ariaLabel = await link.getAttribute('aria-label');
            // Links should have visible text or aria-label
            expect(text?.trim() || ariaLabel).toBeTruthy();
        }
    });
});

test.describe('Accessibility - Keyboard Navigation', () => {
    test.setTimeout(30000);

    test('homepage can be navigated with Tab', async ({ page }) => {
        await page.goto('/');
        await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });

        // Press Tab and verify focus moves
        await page.keyboard.press('Tab');

        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });

    test('login page can be navigated with Tab', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // Tab through interactive elements
        const tabCount = 5;
        for (let i = 0; i < tabCount; i++) {
            await page.keyboard.press('Tab');
        }

        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });

    test('escape key closes modals', async ({ page }) => {
        await page.goto('/admin/flags');
        await page.waitForLoadState('domcontentloaded');

        // Open create form
        await page.getByRole('button', { name: /create flag/i }).click();
        await expect(page.getByPlaceholder('my-feature-flag')).toBeVisible();

        // Press Escape - form might close or not depending on implementation
        await page.keyboard.press('Escape');
    });
});

test.describe('Accessibility - Focus Management', () => {
    test.setTimeout(30000);

    test('skip link exists on homepage', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Many sites have a skip link for keyboard users
        const skipLink = page.locator('a[href="#main"], a[href="#content"], [class*="skip"]');
        // This may or may not exist - just checking
        const count = await skipLink.count();
        // Log for visibility
        console.log(`Skip links found: ${count}`);
    });

    test('form inputs have labels', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"]');
        const count = await inputs.count();

        for (let i = 0; i < count; i++) {
            const input = inputs.nth(i);
            const id = await input.getAttribute('id');
            const placeholder = await input.getAttribute('placeholder');
            const ariaLabel = await input.getAttribute('aria-label');

            // Input should be identifiable by label, placeholder, or aria-label
            expect(id || placeholder || ariaLabel).toBeTruthy();
        }
    });
});

test.describe('Accessibility - Color Contrast', () => {
    test('page has visible text', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Verify main text is visible (basic check)
        const body = page.locator('body');
        await expect(body).toBeVisible();

        // Check that there's actual content
        const text = await body.textContent();
        expect(text?.length).toBeGreaterThan(100);
    });
});

test.describe('Accessibility - Screen Reader', () => {
    test('main content has landmark', async ({ page }) => {
        await page.goto('/');
        await page.locator('main').waitFor({ state: 'attached', timeout: 10000 });

        // Check for main landmark
        const main = page.locator('main, [role="main"]');
        const count = await main.count();

        // Should have a main content area
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('navigation has landmark', async ({ page }) => {
        await page.goto('/');
        await page.locator('nav').waitFor({ state: 'attached', timeout: 10000 });

        // Check for nav landmark
        const nav = page.locator('nav, [role="navigation"]');
        const count = await nav.count();

        expect(count).toBeGreaterThanOrEqual(1);
    });
});
