import { expect, test } from '@playwright/test';
import { WORKER_URL, hashPassword } from '../../fixtures/test-helpers';

const headersFor = (value: unknown): Record<string, string> => value === undefined
  ? {} : { 'x-test-site-passwords': JSON.stringify(value) };

for (const [name, value] of [
  ['unset', undefined],
  ['empty string', ''],
  ['native empty array', []],
  ['native empty passwords', ['', '']],
  ['JSON empty array', '[]'],
  ['JSON empty passwords', '["", ""]'],
] as const) {
  test(`Public site configuration stays compatible: ${name}`, async ({ request }) => {
    const headers = headersFor(value);
    const health = await request.get(`${WORKER_URL}/health_check`, { headers });
    expect(health.status()).toBe(200);
    expect(await health.text()).toBe('OK');
    const settings = await request.get(`${WORKER_URL}/open_api/settings`, { headers });
    expect(settings.status()).toBe(200);
    expect((await settings.json()).needAuth).toBe(false);
    const login = await request.post(`${WORKER_URL}/open_api/site_login`, {
      headers, data: { password: hashPassword('any-password') },
    });
    expect(login.status()).toBe(401);
    expect(await login.json()).toMatchObject({ code: 'AUTH_SITE_PASSWORD_INVALID' });
  });
}

for (const [name, passwords] of [
  ['single', ['e2e-first-pass']],
  ['multiple with empty entries', ['', 'e2e-first-pass', 'e2e-second-pass', '']],
] as const) {
  for (const format of ['native', 'JSON'] as const) {
    test(`Valid site passwords stay compatible: ${format} ${name}`, async ({ request }) => {
      const headers = headersFor(format === 'native' ? passwords : JSON.stringify(passwords));
      const settings = await request.get(`${WORKER_URL}/open_api/settings`, { headers });
      expect(settings.status()).toBe(200);
      expect((await settings.json()).needAuth).toBe(true);
      for (const password of [undefined, 'wrong-password']) {
        const denied = await request.get(`${WORKER_URL}/health_check`, {
          headers: { ...headers, ...(password ? { 'x-custom-auth': password } : {}) },
        });
        expect(denied.status()).toBe(401);
        expect(await denied.json()).toMatchObject({ code: 'AUTH_SITE_PASSWORD_INVALID' });
      }
      for (const password of passwords.filter(Boolean)) {
        const authenticated = { ...headers, 'x-custom-auth': password };
        const health = await request.get(`${WORKER_URL}/health_check`, { headers: authenticated });
        expect(health.status()).toBe(200);
        const settings = await request.get(`${WORKER_URL}/open_api/settings`, { headers: authenticated });
        expect(settings.status()).toBe(200);
        expect((await settings.json()).needAuth).toBe(false);
        const login = await request.post(`${WORKER_URL}/open_api/site_login`, {
          headers, data: { password: hashPassword(password) },
        });
        expect(login.status()).toBe(200);
        expect(await login.json()).toEqual({ success: true });
        const admin = await request.get(`${WORKER_URL}/admin/db_version`, {
          headers: { ...authenticated, 'x-admin-auth': 'e2e-admin-pass' },
        });
        expect(admin.status()).toBe(200);
      }
      const wrongLogin = await request.post(`${WORKER_URL}/open_api/site_login`, {
        headers, data: { password: hashPassword('wrong-password') },
      });
      expect(wrongLogin.status()).toBe(401);
    });
  }
}

test('Site passwords retain whitespace and case', async ({ request }) => {
  for (const value of [[' CaseSensitive '], '[" CaseSensitive "]']) {
    for (const password of [' CaseSensitive ', 'CaseSensitive', ' casesensitive ']) {
      const response = await request.post(`${WORKER_URL}/open_api/site_login`, {
        headers: headersFor(value), data: { password: hashPassword(password) },
      });
      expect(response.status()).toBe(password === ' CaseSensitive ' ? 200 : 401);
    }
  }
});

const secret = 'must-not-appear-in-errors';
for (const [name, value] of [
  ['bare password', secret],
  ['broken JSON', `["${secret}"`],
  ['JSON string', JSON.stringify(secret)],
  ['JSON object', JSON.stringify({ password: secret })],
  ['JSON null', 'null'],
  ['JSON boolean', 'false'],
  ['JSON number', '0'],
  ['JSON number array', '[123]'],
  ['JSON mixed array', JSON.stringify([secret, null])],
  ['native number array', [123]],
  ['native mixed array', [secret, false]],
  ['native null', null],
  ['native boolean', false],
  ['native number', 0],
] as const) {
  test(`Invalid site password configuration fails closed: ${name}`, async ({ request }) => {
    const headers = { ...headersFor(value), 'x-custom-auth': secret, 'x-admin-auth': 'e2e-admin-pass' };
    for (const path of ['/health_check', '/open_api/settings', '/admin/db_version']) {
      const response = await request.get(`${WORKER_URL}${path}`, { headers });
      expect(response.status()).toBe(500);
      expect(await response.json()).toEqual({
        code: 'INTERNAL_SERVER_ERROR', message: 'Error Invalid PASSWORDS configuration',
      });
    }
    const login = await request.post(`${WORKER_URL}/open_api/site_login`, {
      headers, data: { password: hashPassword(secret) },
    });
    expect(login.status()).toBe(500);
    expect(await login.json()).toEqual({
      code: 'INTERNAL_SERVER_ERROR', message: 'Error Invalid PASSWORDS configuration',
    });
    const unaffected = await request.get(`${WORKER_URL}/health_check`);
    expect(unaffected.status()).toBe(200);
  });
}
