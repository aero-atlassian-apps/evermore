import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * 
 * Covers:
 * - Login with email
 * - Login with dev credentials
 * - Session persistence
 * - Logout
 * - Unauthorized access redirect
 */

test.describe('Authentication Flows', () => {
    test.setTimeout(30000);

    test('should redirect unauthenticated users to login', async ({ page }) => {
        // Try to access protected route
        await page.goto('/stories');

        // Should redirect to login
        await expect(page).toHaveURL(/.*\/login/);
    });

    test('should login with dev credentials (senior)', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // Fill dev login form
        await page.getByPlaceholder(/email/i).fill('senior-1@example.com');
        await page.getByPlaceholder(/password/i).fill('password123');

        // Submit
        await page.getByRole('button', { name: /sign in|log in|continue/i }).click();

        // Should redirect to stories (senior dashboard)
        await expect(page).toHaveURL(/.*\/stories/, { timeout: 15000 });
    });

    test('should login with dev credentials (family)', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // Fill dev login form
        await page.getByPlaceholder(/email/i).fill('family-1@example.com');
        await page.getByPlaceholder(/password/i).fill('password123');

        // Submit
        await page.getByRole('button', { name: /sign in|log in|continue/i }).click();

        // Should redirect to family portal
        await expect(page).toHaveURL(/.*\/family/, { timeout: 15000 });
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // Fill invalid credentials
        await page.getByPlaceholder(/email/i).fill('invalid@example.com');
        await page.getByPlaceholder(/password/i).fill('wrongpassword');

        // Submit
        await page.getByRole('button', { name: /sign in|log in|continue/i }).click();

        // Should show error message
        await expect(page.getByText(/not found|invalid|error/i)).toBeVisible({ timeout: 10000 });
    });

    test('should logout successfully', async ({ page }) => {
        // First login
        await page.goto('/login');
        await page.getByPlaceholder(/email/i).fill('senior-1@example.com');
        await page.getByPlaceholder(/password/i).fill('password123');
        await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
        await expect(page).toHaveURL(/.*\/stories/, { timeout: 15000 });

        // Navigate to settings/profile and logout
        await page.goto('/settings');
        await page.getByRole('button', { name: /log out|sign out|logout/i }).click();

        // Should redirect to home or login
        await expect(page).toHaveURL(/^\/$|.*\/login/, { timeout: 10000 });
    });
});
