// End-to-end tests: the real app in a real browser, with the API mocked in-page
// (see e2e/mock-api.ts), so no PinePods server is needed.
import { defineConfig } from '@playwright/test';

const PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the Microsoft Edge already installed on Windows; set PW_CHANNEL=chromium
    // (after `npx playwright install chromium`) on machines without it.
    channel: process.env.PW_CHANNEL ?? 'msedge',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `npx vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Point the dev proxy nowhere: every /api call is answered by the in-page mock.
    env: { PINEPODS_DEV_SERVER: 'http://127.0.0.1:9' }
  }
});
