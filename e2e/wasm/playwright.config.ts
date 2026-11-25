import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results/wasm',
  timeout: 30_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report-wasm' }]],
  projects: [
    { name: 'keep', use: { baseURL: 'http://127.0.0.1:18775' } },
    { name: 'remove-all', use: { baseURL: 'http://127.0.0.1:18776' } },
  ],
  webServer: [
    { command: 'bash scripts/start-worker.sh 18775 false', url: 'http://127.0.0.1:18775/health_check', timeout: 60_000 },
    { command: 'bash scripts/start-worker.sh 18776 true', url: 'http://127.0.0.1:18776/health_check', timeout: 60_000 },
  ],
});
