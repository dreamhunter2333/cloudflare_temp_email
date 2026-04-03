import { defineConfig, devices } from '@playwright/test';

const WORKER_BASE = process.env.WORKER_URL!;
const WORKER_GZIP_BASE = process.env.WORKER_GZIP_URL || '';
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
      name: 'api-gzip',
      testDir: './tests/api-gzip',
      use: {
        baseURL: WORKER_GZIP_BASE,
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
        // Accept self-signed cert from Docker frontend (HTTPS for WebAuthn)
        ignoreHTTPSErrors: true,
      },
    },
  ],
});
