import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the production build in dist/ (run `npm run build` first).
const PORT = 4330;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/physics-simulations/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node tests/e2e/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/physics-simulations/ro/`,
    reuseExistingServer: !process.env.CI,
  },
});
