import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * 
 * World-Class Features:
 * - Retries on failure (2 in CI)
 * - Trace artifacts on failure
 * - Screenshot on failure
 * - Video on failure
 * - Parallel execution in CI
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // Retries for flaky test resilience
  retries: process.env.CI ? 2 : 1,

  // Workers for parallelization
  workers: process.env.CI ? 2 : undefined,

  // Rich reporting
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-report.json' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  // Timeout settings
  timeout: 120000, // 2 minutes per test
  expect: {
    timeout: 30000,
  },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    // Trace on first retry and on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure (useful for debugging)
    video: 'on-first-retry',

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Action timeout
    actionTimeout: 30000,
  },

  projects: [
    // Desktop Chrome (primary)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Desktop Firefox (cross-browser)
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Mobile Chrome (responsive)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Web server configuration
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Output directory for artifacts
  outputDir: 'test-results',
});
