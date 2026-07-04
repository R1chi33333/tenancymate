import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3602',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start -- --port 3602',
    url: 'http://localhost:3602',
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
    env: {
      DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
      GROQ_API_KEY: 'unused',
    },
  },
});
