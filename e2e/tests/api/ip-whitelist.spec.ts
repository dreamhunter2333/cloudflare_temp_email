import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress } from '../../fixtures/test-helpers';

const ADMIN_PASSWORD = 'e2e-admin-pass';

const RESET_SETTINGS = {
  enabled: false,
  blacklist: [],
  asnBlacklist: [],
  fingerprintBlacklist: [],
  enableWhitelist: false,
  whitelist: [],
  enableDailyLimit: false,
  dailyRequestLimit: 1000,
};

test.describe('IP Whitelist Settings', () => {
  test.afterEach(async ({ request }) => {
    await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: RESET_SETTINGS,
    });
  });

  test('get default IP whitelist settings returns disabled with empty list', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
    });
    expect(res.ok()).toBe(true);
    const settings = await res.json();
    expect(settings.enableWhitelist).toBeFalsy();
    expect(settings.whitelist).toEqual([]);
  });

  test('save and retrieve IP whitelist settings', async ({ request }) => {
    // Save whitelist settings
    const saveRes = await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        enabled: false,
        blacklist: [],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        enableWhitelist: true,
        whitelist: ['1.2.3.4', '^192\\.168\\.1\\.\\d+$'],
        enableDailyLimit: false,
        dailyRequestLimit: 1000,
      },
    });
    expect(saveRes.ok()).toBe(true);
    const saveBody = await saveRes.json();
    expect(saveBody.success).toBe(true);

    // Retrieve and verify
    const getRes = await request.get(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
    });
    expect(getRes.ok()).toBe(true);
    const settings = await getRes.json();
    expect(settings.enableWhitelist).toBe(true);
    expect(settings.whitelist).toEqual(['1.2.3.4', '^192\\.168\\.1\\.\\d+$']);
  });

  test('whitelist rejects empty list when enabled', async ({ request }) => {
    // Note: Frontend blocks this, but backend allows it (empty list = ignored)
    // This test verifies backend behavior
    const saveRes = await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        enabled: false,
        blacklist: [],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        enableWhitelist: true,
        whitelist: [],
        enableDailyLimit: false,
        dailyRequestLimit: 1000,
      },
    });
    // Backend accepts empty whitelist (it will be ignored at runtime)
    expect(saveRes.ok()).toBe(true);
  });

  test('whitelist validates array type', async ({ request }) => {
    const saveRes = await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        enabled: false,
        blacklist: [],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        enableWhitelist: true,
        whitelist: 'not-an-array', // Invalid type
        enableDailyLimit: false,
        dailyRequestLimit: 1000,
      },
    });
    expect(saveRes.ok()).toBe(false);
    expect(saveRes.status()).toBe(400);
  });

  test('whitelist enforces max size limit', async ({ request }) => {
    const largeList = Array.from({ length: 1001 }, (_, i) => `1.2.3.${i % 256}`);
    const saveRes = await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        enabled: false,
        blacklist: [],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        enableWhitelist: true,
        whitelist: largeList,
        enableDailyLimit: false,
        dailyRequestLimit: 1000,
      },
    });
    expect(saveRes.ok()).toBe(false);
    expect(saveRes.status()).toBe(400);
    const body = await saveRes.text();
    expect(body).toContain('whitelist');
    expect(body).toContain('1000');
  });

  test('backward compatibility: old frontend without whitelist fields', async ({ request }) => {
    // Simulate old frontend that doesn't send enableWhitelist/whitelist
    const saveRes = await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        enabled: true,
        blacklist: ['10.0.0.1'],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        // enableWhitelist and whitelist omitted
        enableDailyLimit: false,
        dailyRequestLimit: 1000,
      },
    });
    // Should succeed with defaults applied
    expect(saveRes.ok()).toBe(true);

    // Verify defaults were applied
    const getRes = await request.get(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
    });
    expect(getRes.ok()).toBe(true);
    const settings = await getRes.json();
    expect(settings.enableWhitelist).toBe(false);
    expect(settings.whitelist).toEqual([]);
  });

  test('whitelist sanitizes patterns (trims and removes empty)', async ({ request }) => {
    const saveRes = await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        enabled: false,
        blacklist: [],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        enableWhitelist: true,
        whitelist: ['  1.2.3.4  ', '', '   ', '5.6.7.8'],
        enableDailyLimit: false,
        dailyRequestLimit: 1000,
      },
    });
    expect(saveRes.ok()).toBe(true);

    const getRes = await request.get(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
    });
    expect(getRes.ok()).toBe(true);
    const settings = await getRes.json();
    // Empty strings should be filtered out, whitespace trimmed
    expect(settings.whitelist).toEqual(['1.2.3.4', '5.6.7.8']);
  });

  test('whitelist rejects invalid regex pattern', async ({ request }) => {
    const saveRes = await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: { ...RESET_SETTINGS, whitelist: ['^[1.2.3.4$'] }, // invalid regex
    });
    expect(saveRes.ok()).toBe(false);
    expect(saveRes.status()).toBe(400);
    expect(await saveRes.text()).toContain('whitelist');
  });

  test('whitelist rejects non-string elements', async ({ request }) => {
    const saveRes = await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: { ...RESET_SETTINGS, whitelist: [1, null] },
    });
    expect(saveRes.ok()).toBe(false);
    expect(saveRes.status()).toBe(400);
  });
});

test.describe('IP Whitelist Runtime Behavior', () => {
  test('whitelist with empty list allows requests (protection mode)', async ({ request }) => {
    // Enable whitelist with empty list
    await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        enabled: false,
        blacklist: [],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        enableWhitelist: true,
        whitelist: [],
        enableDailyLimit: false,
        dailyRequestLimit: 1000,
      },
    });

    // Try to create address (rate-limited endpoint)
    // Should succeed because empty whitelist is ignored
    const res = await createTestAddress(request, 'whitelist-empty');
    expect(res.jwt).toBeTruthy();
    expect(res.address).toBeTruthy();
  });

  test('whitelist blocks requests when IP does not match whitelist', async ({ request }) => {
    await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        ...RESET_SETTINGS,
        enableWhitelist: true,
        whitelist: ['1.2.3.4'],
      },
    });

    // In e2e, cf-connecting-ip is absent → fail-closed → 403
    const res = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name: `whitelist-block-${Date.now()}`, domain: 'test.example.com' },
    });
    expect(res.status()).toBe(403);
    const body = await res.text();
    expect(body).toContain('IP');
  });

  test('fingerprint blacklist blocks even when cf-connecting-ip is absent', async ({ request }) => {
    await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        ...RESET_SETTINGS,
        enabled: true,
        fingerprintBlacklist: ['blocked-fingerprint-123'],
      },
    });

    const res = await request.post(`${WORKER_URL}/api/new_address`, {
      headers: { 'x-fingerprint': 'blocked-fingerprint-123' },
      data: { name: `fp-block-${Date.now()}`, domain: 'test.example.com' },
    });
    expect(res.status()).toBe(403);
    expect(await res.text()).toContain('fingerprint');
  });

  test.afterEach(async ({ request }) => {
    // Reset whitelist to disabled after each test
    await request.post(`${WORKER_URL}/admin/ip_blacklist/settings`, {
      headers: { 'x-admin-auth': ADMIN_PASSWORD },
      data: {
        enabled: false,
        blacklist: [],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        enableWhitelist: false,
        whitelist: [],
        enableDailyLimit: false,
        dailyRequestLimit: 1000,
      },
    });
  });
});

