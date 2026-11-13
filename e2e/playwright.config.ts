import { defineConfig, devices } from '@playwright/test';

const WORKER_BASE = process.env.WORKER_URL!;
const FRONTEND_BASE = process.env.FRONTEND_URL!;
const workerCount = process.env.PLAYWRIGHT_WORKERS || '1';

export default defineConfig({
  timeout: 30_000,
  retries: 0,
  workers: workerCount.endsWith('%') ? workerCount : Number(workerCount),
  reporter: [['html', { open: 'never' }]],
  projects: [
    {
      name: 'api',
      workers: 1,
      testDir: './api/tests',
      use: {
        baseURL: WORKER_BASE,
      },
    },
    {
      name: 'smtp-proxy',
      workers: 1,
      testDir: './smtp-proxy/tests',
      use: {
        baseURL: WORKER_BASE,
      },
    },
    {
      name: 'browser',
      fullyParallel: true,
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
      fullyParallel: true,
      testDir: './webhook/tests',
      use: {
        baseURL: FRONTEND_BASE,
        ...devices['Desktop Chrome'],
        ignoreHTTPSErrors: true,
      },
    },
  ],
});
