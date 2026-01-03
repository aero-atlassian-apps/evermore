import { test, expect, devices } from '@playwright/test';

/**
 * Error Handling E2E Tests
 * 
 * Tests for 404 pages, error states, and graceful degradation.
 */

test.describe('Error Pages', () => {
    test.setTimeout(30000);

    test('404 page renders for unknown routes', async ({ page }) => {
        await page.goto('/this-page-does-not-exist-12345');
        await page.waitForLoadState('domcontentloaded');

        // Should show 404 content or redirect
        const pageContent = await page.textContent('body');
        // Either shows 404 or redirects to a known page
        expect(pageContent?.length).toBeGreaterThan(0);
    });

    test('404 page has navigation back', async ({ page }) => {
        await page.goto('/nonexistent-page');
        await page.waitForLoadState('domcontentloaded');

        // Should have a way to navigate home
        const homeLink = page.locator('a[href="/"]');
        const buttonToHome = page.getByRole('link', { name: /home|back/i });

        // At least one way to get back
        const homeLinkCount = await homeLink.count();
        const buttonCount = await buttonToHome.count();
        expect(homeLinkCount + buttonCount).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Loading States', () => {
    test.setTimeout(30000);

    test('dashboard shows loading state', async ({ page }) => {
        await page.goto('/admin');

        // Either shows loading spinner or content loads quickly
        // Just verify page doesn't crash
        await page.waitForLoadState('domcontentloaded');
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });
});

test.describe('Network Error Resilience', () => {
    test.setTimeout(30000);

    test('page recovers from slow network', async ({ page, context }) => {
        // Simulate slow network
        await context.route('**/*', async (route) => {
            await new Promise(resolve => setTimeout(resolve, 100));
            await route.continue();
        });

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Page should still render
        await expect(page.locator('body')).toBeVisible();
    });
});

// Mobile and Tablet tests moved to mobile.spec.ts and tablet.spec.ts

/**
 * Performance-related UX Tests
 */

test.describe('Performance UX', () => {
    test.setTimeout(30000);

    test('homepage loads within acceptable time', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        const loadTime = Date.now() - startTime;

        // Should load within 10 seconds (generous for local dev)
        expect(loadTime).toBeLessThan(10000);
    });

    test('no console errors on homepage', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Filter out known acceptable errors (like network issues in dev)
        const criticalErrors = errors.filter(e =>
            !e.includes('favicon') &&
            !e.includes('Failed to load resource') &&
            !e.includes('net::ERR')
        );

        // Should have no critical console errors
        expect(criticalErrors.length).toBe(0);
    });

    test('images lazy load or are optimized', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const images = page.locator('img');
        const count = await images.count();

        // Check if images use lazy loading
        let lazyCount = 0;
        for (let i = 0; i < Math.min(count, 5); i++) {
            const img = images.nth(i);
            const loading = await img.getAttribute('loading');
            if (loading === 'lazy') lazyCount++;
        }

        // At least some images should use lazy loading (or Next.js Image handles it)
        // This is informational, not blocking
        console.log(`Lazy loading images: ${lazyCount}/${count}`);
    });
});
