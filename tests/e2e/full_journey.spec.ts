import { test, expect } from '@playwright/test';

test.describe('Evermore Full User Journey', () => {

    test.setTimeout(60000);

    test('Visitor can sign up, select persona, and view dashboard', async ({ page }) => {
        console.log('Test 1: Starting');
        // 1. Landing Page
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded'); // Ensure DOM is ready
        await expect(page).toHaveTitle(/Evermore/i);
        console.log('Test 1: Home Loaded');

        // 2. Navigate to Onboarding (Clicking Hero CTA)
        // Exact text from MarketingHero.tsx: "Get Started Free"
        const cta = page.getByRole('link', { name: 'Get Started Free' }).first();
        await expect(cta).toBeVisible();
        await cta.click({ force: true });

        console.log('Test 1: CTA Clicked, waiting for URL');
        await expect(page).toHaveURL(/.*\/onboarding/, { timeout: 15000 });
        await page.waitForLoadState('domcontentloaded');

        // 3. Onboarding Flow (Select Myself -> Continue)
        await page.getByText('Myself').first().click();
        await page.getByRole('button', { name: /Continue/i }).click();

        // 4. Verify Signup Page (with query param)
        await expect(page).toHaveURL(/.*\/signup.*type=senior/);

        // 5. Complete Signup Form
        const email = `test-${Date.now()}@example.com`;
        await page.getByPlaceholder('Arthur Pendelton').fill('Arthur Dent');
        await page.getByPlaceholder('your@email.com').fill(email);
        await page.getByPlaceholder('••••••••').fill('password123');

        // Persona selection should be pre-filled or clickable. 
        // The text 'Storyteller' might be selected by default or we click it to be safe.
        await page.locator('text=Storyteller').click();

        await page.getByRole('button', { name: /Continue/i }).click();

        // 6. Verify Redirection to Stories (Dashboard)
        await page.waitForURL(/.*\/stories/);
        await expect(page).toHaveURL(/.*\/stories/);

        // 7. Verify Core Elements present
        await expect(page.getByText('Your Memory Archive')).toBeVisible();

        // 8. Navigation Check - Profile
        await page.getByRole('link', { name: 'Profile' }).click();
        await expect(page).toHaveURL(/.*\/profile/);
    });

    test('Family Member can sign up and view Portal', async ({ page }) => {
        // 1. Signup directly (or via onboarding, but let's test direct link too if supported, or same flow)
        // Let's test the flow from Onboarding for Family too to be robust
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.getByRole('link', { name: 'Get Started Free' }).first().click({ force: true });

        // Select Relative
        await page.waitForURL(/.*\/onboarding/);
        await page.getByText('A Relative').first().click();
        await page.getByRole('button', { name: /Continue/i }).click();

        await expect(page).toHaveURL(/.*\/signup.*type=family/);

        const email = `family-${Date.now()}@example.com`;
        await page.getByPlaceholder('Arthur Pendelton').fill('Ford Prefect');
        await page.getByPlaceholder('your@email.com').fill(email);
        await page.getByPlaceholder('••••••••').fill('password123');

        // Verify/Click Family Member
        await page.locator('text=Family Member').click();

        await page.getByRole('button', { name: /Continue/i }).click();

        // 2. Verify Redirection to Family Portal
        await page.waitForURL(/.*\/family/);
        await expect(page).toHaveURL(/.*\/family/);
        await expect(page.getByText('Ford Prefect Portal')).toBeVisible();
    });
});
