import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the real stack: Vite (proxy) → PHANTOM API → PostgreSQL.
 * Start the API yourself (`dotnet run --project src/PHANTOM.API` in Phantom_API) or let
 * Playwright start it. Demo credentials come from PHANTOM_DEMO_PASSWORD, never from source.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  // The development database is remote (Neon) and may be waking from auto-suspend.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'dotnet run --project ../../backend/Phantom_API/src/PHANTOM.API --launch-profile http',
      url: 'http://localhost:5080/health/live',
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
})
