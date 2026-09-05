import { expect, test } from '@playwright/test';
import { createHmac } from 'node:crypto';
import {
  WORKER_URL_ENV_OFF,
  WORKER_URL_SITE_PASSWORD,
} from '../../fixtures/test-helpers';

const SITE_HEADERS = { 'x-custom-auth': 'e2e-site-pass' };
const ADMIN_HEADERS = { ...SITE_HEADERS, 'x-admin-auth': 'e2e-admin-pass' };
const futureExpiration = () => new Date(Date.now() + 3_600_000).toISOString();

const signTestToken = (payload: Record<string, unknown>, secret = 'e2e-site-password-secret') => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
};

const tokenPayload = (role: string) => ({
  user_id: 1,
  user_role: role,
  exp: Math.floor(Date.now() / 1000) + 3600,
});

test.describe('Redemption feature access boundaries', () => {
  test('the disabled switch hides every user and Admin endpoint', async ({ request }) => {
    const settingsResponse = await request.get(`${WORKER_URL_ENV_OFF}/open_api/settings`);
    expect(settingsResponse.ok()).toBe(true);
    expect((await settingsResponse.json()).enableRedeemCode).toBe(false);

    const requests = [
      request.post(`${WORKER_URL_ENV_OFF}/redeem_api/query`, { data: { code: 'anything' } }),
      request.post(`${WORKER_URL_ENV_OFF}/redeem_api/result`, { data: { code: 'anything' } }),
      request.post(`${WORKER_URL_ENV_OFF}/redeem_api/redeem`, {
        data: { code: 'anything', user_email: 'user@test.example.com' },
      }),
      request.get(`${WORKER_URL_ENV_OFF}/admin/redeem_codes?redeem_type=role`),
      request.get(`${WORKER_URL_ENV_OFF}/admin/redeem_codes/export?redeem_type=role&limit=1`),
      request.post(`${WORKER_URL_ENV_OFF}/admin/redeem_codes/batch`, {
        data: {
          count: 1,
          redeem_type: 'role',
          value: 'case-role',
          enabled: true,
          expires_at: futureExpiration(),
        },
      }),
      request.put(`${WORKER_URL_ENV_OFF}/admin/redeem_codes/1`, {
        data: {
          redeem_type: 'role',
          value: 'case-role',
          enabled: true,
          expires_at: futureExpiration(),
        },
      }),
      request.delete(`${WORKER_URL_ENV_OFF}/admin/redeem_codes/1`),
    ];
    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.status()).toBe(404);
    }
  });

  test('site password takes priority over otherwise public redemption APIs', async ({ request }) => {
    const settingsResponse = await request.get(`${WORKER_URL_SITE_PASSWORD}/open_api/settings`);
    expect(settingsResponse.ok()).toBe(true);
    expect(await settingsResponse.json()).toMatchObject({
      needAuth: true,
      enableRedeemCode: true,
    });

    const blockedAdminResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/batch`,
      {
        headers: { 'x-admin-auth': 'e2e-admin-pass' },
        data: {
          count: 1,
          redeem_type: 'role',
          value: 'case-role',
          enabled: true,
          expires_at: futureExpiration(),
        },
      },
    );
    expect(blockedAdminResponse.status()).toBe(401);

    const createResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/batch`,
      {
        headers: ADMIN_HEADERS,
        data: {
          count: 1,
          redeem_type: 'role',
          value: 'case-role',
          enabled: true,
          expires_at: futureExpiration(),
        },
      },
    );
    expect(createResponse.ok()).toBe(true);
    const code = (await createResponse.json()).codes[0] as string;

    for (const path of ['query', 'result', 'redeem']) {
      const missingPassword = await request.post(
        `${WORKER_URL_SITE_PASSWORD}/redeem_api/${path}`,
        { data: { code } },
      );
      expect(missingPassword.status()).toBe(401);
      const wrongPassword = await request.post(
        `${WORKER_URL_SITE_PASSWORD}/redeem_api/${path}`,
        { headers: { 'x-custom-auth': 'wrong' }, data: { code } },
      );
      expect(wrongPassword.status()).toBe(401);
    }
    const validPassword = await request.post(`${WORKER_URL_SITE_PASSWORD}/redeem_api/query`, {
      headers: SITE_HEADERS,
      data: { code },
    });
    expect(validPassword.ok()).toBe(true);
    expect(await validPassword.json()).toEqual({
      redeem_type: 'role', value: 'case-role', status: 'unused',
    });

    const listResponse = await request.get(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes?redeem_type=role`
      + `&limit=20&offset=0&query=${encodeURIComponent(code)}`,
      { headers: ADMIN_HEADERS },
    );
    const row = (await listResponse.json()).results[0];
    const deleteResponse = await request.delete(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/${row.id}`,
      { headers: ADMIN_HEADERS },
    );
    expect(deleteResponse.ok()).toBe(true);
  });

  test('special-address redemption preserves the configured address regex', async ({ request }) => {
    const createResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/batch`,
      {
        headers: ADMIN_HEADERS,
        data: {
          count: 1,
          redeem_type: 'address_prefix_once',
          value: '',
          enabled: true,
          expires_at: futureExpiration(),
        },
      },
    );
    expect(createResponse.ok()).toBe(true);
    const code = (await createResponse.json()).codes[0] as string;

    const redeemResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/redeem_api/redeem`,
      {
        headers: SITE_HEADERS,
        data: { code, name: 'blocked', domain: 'test.example.com' },
      },
    );
    expect(redeemResponse.status()).toBe(400);

    const queryResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/redeem_api/query`,
      { headers: SITE_HEADERS, data: { code } },
    );
    expect(queryResponse.ok()).toBe(true);

    const listResponse = await request.get(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes?redeem_type=address_prefix_once`
      + `&limit=20&offset=0&query=${encodeURIComponent(code)}`,
      { headers: ADMIN_HEADERS },
    );
    const row = (await listResponse.json()).results[0];
    const deleteResponse = await request.delete(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/${row.id}`,
      { headers: ADMIN_HEADERS },
    );
    expect(deleteResponse.ok()).toBe(true);
  });
});

test.describe('Redemption Admin authentication', () => {
  const baseUrl = `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes`;
  const listUrl = `${baseUrl}?redeem_type=address_prefix_once&limit=100&offset=0`;
  const codeData = () => ({
    count: 1,
    redeem_type: 'address_prefix_once',
    value: 'auth',
    enabled: true,
    expires_at: futureExpiration(),
  });
  const deniedCredentials: { name: string; headers: () => Record<string, string> }[] = [
    { name: 'site password alone', headers: () => ({}) },
    { name: 'wrong Admin password', headers: () => ({ 'x-admin-auth': 'wrong' }) },
    {
      name: 'mailbox JWT',
      headers: () => ({
        Authorization: `Bearer ${signTestToken({ address: 'mail@test.example.com', address_id: 1 })}`,
      }),
    },
    {
      name: 'user account JWT',
      headers: () => ({
        'x-user-token': signTestToken({ user_id: 1, exp: Math.floor(Date.now() / 1000) + 3600 }),
      }),
    },
    {
      name: 'non-Admin role token',
      headers: () => ({ 'x-user-access-token': signTestToken(tokenPayload('case-role')) }),
    },
    {
      name: 'forged Admin role token',
      headers: () => ({ 'x-user-access-token': signTestToken(tokenPayload('admin'), 'wrong-secret') }),
    },
    {
      name: 'expired Admin role token',
      headers: () => ({
        'x-user-access-token': signTestToken({ ...tokenPayload('admin'), exp: Math.floor(Date.now() / 1000) - 60 }),
      }),
    },
    {
      name: 'Admin role token without expiration',
      headers: () => ({ 'x-user-access-token': signTestToken({ user_id: 1, user_role: 'admin' }) }),
    },
    { name: 'malformed role token', headers: () => ({ 'x-user-access-token': 'not-a-jwt' }) },
  ];

  for (const credentials of deniedCredentials) {
    test(`rejects ${credentials.name} on all five endpoints without changing data`, async ({ request }) => {
      const original = codeData();
      const created = await request.post(`${baseUrl}/batch`, { headers: ADMIN_HEADERS, data: original });
      expect(created.ok()).toBe(true);
      const code = (await created.json()).codes[0] as string;
      const beforeResponse = await request.get(listUrl, { headers: ADMIN_HEADERS });
      expect(beforeResponse.ok()).toBe(true);
      const before = await beforeResponse.json();
      const row = before.results.find((item: { code: string }) => item.code === code);
      expect(row).toBeDefined();
      try {
        const headers = { ...SITE_HEADERS, ...credentials.headers() };
        const responses = await Promise.all([
          request.get(listUrl, { headers }),
          request.get(`${baseUrl}/export?redeem_type=address_prefix_once&limit=100`, { headers }),
          request.post(`${baseUrl}/batch`, { headers, data: original }),
          request.put(`${baseUrl}/${row.id}`, { headers, data: { ...original, value: 'changed' } }),
          request.delete(`${baseUrl}/${row.id}`, { headers }),
        ]);
        for (const response of responses) {
          expect(response.status(), response.url()).toBe(401);
          expect(await response.text()).not.toContain(code);
        }
        const after = await request.get(listUrl, { headers: ADMIN_HEADERS });
        expect(after.ok()).toBe(true);
        expect(await after.json()).toEqual(before);
      } finally {
        const deleted = await request.delete(`${baseUrl}/${row.id}`, { headers: ADMIN_HEADERS });
        expect(deleted.ok()).toBe(true);
      }
    });
  }

  for (const authType of ['password', 'role token'] as const) {
    test(`accepts a valid Admin ${authType} for all five endpoints`, async ({ request }) => {
      const headers: Record<string, string> = authType === 'password'
        ? ADMIN_HEADERS
        : { ...SITE_HEADERS, 'x-user-access-token': signTestToken(tokenPayload('admin')) };
      const original = codeData();
      const created = await request.post(`${baseUrl}/batch`, { headers, data: original });
      expect(created.ok()).toBe(true);
      const code = (await created.json()).codes[0] as string;
      const listResponse = await request.get(listUrl, { headers });
      expect(listResponse.ok()).toBe(true);
      const row = (await listResponse.json()).results.find((item: { code: string }) => item.code === code);
      expect(row).toBeDefined();
      let deleted = false;
      try {
        const exported = await request.get(`${baseUrl}/export?redeem_type=address_prefix_once&limit=100`, { headers });
        expect(exported.ok()).toBe(true);
        expect(exported.headers()['content-type']).toContain('text/csv');
        expect(await exported.text()).toContain(code);

        const updated = await request.put(`${baseUrl}/${row.id}`, { headers, data: { ...original, value: 'updated' } });
        expect(updated.ok()).toBe(true);
        const afterUpdate = await request.get(`${listUrl}&query=${encodeURIComponent(code)}`, { headers });
        expect(afterUpdate.ok()).toBe(true);
        expect((await afterUpdate.json()).results).toEqual([
          expect.objectContaining({ id: row.id, code, value: 'updated' }),
        ]);

        const deletion = await request.delete(`${baseUrl}/${row.id}`, { headers });
        expect(deletion.ok()).toBe(true);
        deleted = true;
        const afterDelete = await request.get(`${listUrl}&query=${encodeURIComponent(code)}`, { headers });
        expect(afterDelete.ok()).toBe(true);
        expect(await afterDelete.json()).toEqual({ results: [], count: 0 });
      } finally {
        if (!deleted) {
          const cleanup = await request.delete(`${baseUrl}/${row.id}`, { headers: ADMIN_HEADERS });
          expect(cleanup.ok()).toBe(true);
        }
      }
    });
  }
});
