import { test, expect } from '@playwright/test';
import { WORKER_URL, TEST_DOMAIN, createTestAddress } from '../../fixtures/test-helpers';

// Regression tests for #956: long admin search queries must not trigger
// D1's "LIKE or GLOB pattern too complex" error.
test.describe('Admin Address Query (#956)', () => {
  test('short query (subdomain fragment) returns matching address via LIKE', async ({ request }) => {
    const created = await createTestAddress(request, 'q956short');
    const fragment = created.address.split('@')[0].slice(0, 8);

    const res = await request.get(`${WORKER_URL}/admin/address`, {
      params: { limit: '20', offset: '0', query: fragment },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    const names: string[] = body.results.map((r: any) => r.name);
    expect(names).toContain(created.address);
  });

  test('long query (>50-byte pattern) does not crash with D1 LIKE error', async ({ request }) => {
    const longQuery = 'a48r893s@5hx7zb.nationalgeographic.algomindtrade.com';
    expect(new TextEncoder().encode(`%${longQuery}%`).length).toBeGreaterThan(50);

    const res = await request.get(`${WORKER_URL}/admin/address`, {
      params: { limit: '20', offset: '0', query: longQuery },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBe(0);
    expect(body.count).toBe(0);
  });

  test('long query also works for /admin/users', async ({ request }) => {
    const longQuery = 'no-such-user-' + 'x'.repeat(40) + `@${TEST_DOMAIN}`;
    expect(new TextEncoder().encode(`%${longQuery}%`).length).toBeGreaterThan(50);

    const res = await request.get(`${WORKER_URL}/admin/users`, {
      params: { limit: '20', offset: '0', query: longQuery },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBe(0);
    expect(body.count).toBe(0);
  });
});
