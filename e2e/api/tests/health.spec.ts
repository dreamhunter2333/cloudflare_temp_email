import { test, expect } from '@playwright/test';
import { WORKER_URL } from '../../fixtures/test-helpers';

test.describe('Health & Settings', () => {
  test('GET /health_check returns OK', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/health_check`);
    expect(res.ok()).toBe(true);
    expect(await res.text()).toBe('OK');
  });

  test('GET /open_api/settings returns correct domains and sendMail enabled', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/open_api/settings`);
    expect(res.ok()).toBe(true);

    const settings = await res.json();
    expect(settings.domains).toContain('test.example.com');
    expect(settings.defaultDomains).toContain('test.example.com');
    expect(settings.prefix).toBe('tmp');
    expect(settings.enableSendMail).toBe(true);
    expect(settings.enableUserCreateEmail).toBe(true);
    expect(settings.enableUserDeleteEmail).toBe(true);
  });
});
