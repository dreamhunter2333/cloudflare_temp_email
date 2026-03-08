import { defineConfig, devices } from '@playwright/test';

const WORKER_BASE = process.env.WORKER_URL!;
const FRONTEND_BASE = process.env.FRONTEND_URL!;

export default defineConfig({
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: WORKER_BASE,
      },
    },
    {
      name: 'smtp-proxy',
      testDir: './tests/smtp-proxy',
      use: {
        baseURL: WORKER_BASE,
      },
    },
    {
      name: 'browser',
      testDir: './tests/browser',
      use: {
        baseURL: FRONTEND_BASE,
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // Allow crypto.subtle in non-HTTPS Docker origins
            `--unsafely-treat-insecure-origin-as-secure=${FRONTEND_BASE}`,
          ],
        },
      },
    },
  ],
});
