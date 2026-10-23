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
      testDir: './api/tests',
      use: {
        baseURL: WORKER_BASE,
      },
    },
    {
      name: 'smtp-proxy',
      testDir: './smtp-proxy/tests',
      use: {
        baseURL: WORKER_BASE,
      },
    },
    {
      name: 'browser',
      testDir: './browser/tests',
      use: {
        baseURL: FRONTEND_BASE,
        ...devices['Desktop Chrome'],
        // Accept self-signed cert from Docker frontend (HTTPS for WebAuthn)
        ignoreHTTPSErrors: true,
      },
    },
    {
      name: 'webhook',
      testDir: './webhook/tests',
      use: {
        baseURL: FRONTEND_BASE,
        ...devices['Desktop Chrome'],
        ignoreHTTPSErrors: true,
      },
    },
  ],
});
