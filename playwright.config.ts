import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { resolveBase } from './scripts/build-info.ts'

const PORT = 4173
// Same base (and same `.env*` + env precedence) as `vite.config.ts`, so the suite runs on the build as published (e.g. under /dni-print/).
const BASE_URL = `http://localhost:${PORT}${resolveBase({ ...loadEnv('production', process.cwd(), ''), ...process.env }.VITE_BASE)}`

// E2E runs against the production build (`npm run build`) served by `vite preview`.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The shared CI runner is slow and noisy: a test that passes on retry is reported as flaky, not failed.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /camera\.spec/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /camera\.spec/ },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
})
