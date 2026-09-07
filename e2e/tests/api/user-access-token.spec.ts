import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { WORKER_URL, WORKER_URL_SITE_PASSWORD } from '../../fixtures/test-helpers';

for (const scenario of ['expired role', 'valid role', 'invalid signature', 'missing expiry', 'admin password', 'wrong password'] as const) {
  test(`Admin role token errors remain distinct from password errors: ${scenario}`, async ({ request }) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      user_id: 1, user_role: 'admin',
      exp: scenario === 'missing expiry' ? undefined
        : Math.floor(Date.now() / 1000) + (scenario === 'valid role' || scenario === 'invalid signature' ? 3600 : -60),
    })).toString('base64url');
    const signature = createHmac('sha256', scenario === 'invalid signature' ? 'wrong-secret' : 'e2e-site-password-secret')
      .update(`${header}.${payload}`).digest('base64url');
    const headers: Record<string, string> = { 'x-custom-auth': 'e2e-site-pass', 'x-lang': 'en' };
    if (scenario !== 'wrong password') headers['x-user-access-token'] = `${header}.${payload}.${signature}`;
    if (scenario === 'admin password') headers['x-admin-auth'] = 'e2e-admin-pass';
    if (scenario === 'wrong password') headers['x-admin-auth'] = 'wrong-password';
    const response = await request.get(`${WORKER_URL_SITE_PASSWORD}/admin/db_version`, { headers });
    if (scenario === 'expired role') {
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({
        code: 'AUTH_USER_ACCESS_TOKEN_EXPIRED',
        message: 'Your access token has expired, please refresh the page',
      });
    } else if (scenario === 'missing expiry') {
      expect(response.status()).toBe(401);
      expect(await response.text()).toBe('Your access token has expired, please refresh the page');
    } else if (scenario === 'valid role' || scenario === 'admin password') {
      expect(response.ok()).toBe(true);
    } else {
      expect(response.status()).toBe(401);
      expect(await response.text()).toBe('You need to provide the admin password to access this page');
    }
  });
}

test('generic authentication errors preserve their text messages and CORS headers', async ({ request }) => {
  for (const { path, message } of [
    { path: '/api/settings', message: 'Invalid address credential' },
    { path: '/user_api/settings', message: 'Your token has expired, please login again' },
  ]) {
    const response = await request.get(`${WORKER_URL}${path}`, { headers: { 'x-lang': 'en' } });
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(await response.text()).toBe(message);
  }
});

test('uncaught server errors return JSON with the original error detail', async ({ request }) => {
  const response = await request.post(`${WORKER_URL}/open_api/admin_login`, {
    headers: { 'content-type': 'application/json' },
    data: Buffer.from('{invalid-json'),
  });
  expect(response.status()).toBe(500);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual({ code: 'INTERNAL_SERVER_ERROR', message: expect.stringContaining('SyntaxError') });
});
