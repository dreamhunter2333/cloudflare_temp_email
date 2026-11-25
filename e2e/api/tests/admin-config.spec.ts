import { expect, test } from '@playwright/test';
import { WORKER_URL } from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };

test.describe('Admin Config and D1 Storage', () => {
  test('reports database size in the database status response', async ({ request }) => {
    const response = await request.get(`${WORKER_URL}/admin/db_version`, {
      headers: ADMIN_HEADERS,
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.database_size).toEqual(expect.any(Number));
    expect(body.database_size).toBeGreaterThan(0);
  });

  test('saves and retrieves a namespaced config value', async ({ request }) => {
    const saveResponse = await request.post(`${WORKER_URL}/admin/config`, {
      headers: ADMIN_HEADERS,
      data: { key: 'd1_storage_plan', value: 'free' },
    });

    expect(saveResponse.ok()).toBe(true);
    expect(await saveResponse.json()).toEqual({
      success: true,
      key: 'd1_storage_plan',
      value: 'free',
    });

    const getResponse = await request.get(`${WORKER_URL}/admin/config/d1_storage_plan`, {
      headers: ADMIN_HEADERS,
    });

    expect(getResponse.ok()).toBe(true);
    expect(await getResponse.json()).toEqual({
      key: 'd1_storage_plan',
      value: 'free',
    });
  });

  test('keeps config values isolated from internal settings', async ({ request }) => {
    const versionBeforeResponse = await request.get(`${WORKER_URL}/admin/db_version`, {
      headers: ADMIN_HEADERS,
    });
    const versionBefore = (await versionBeforeResponse.json()).current_db_version;

    const saveResponse = await request.post(`${WORKER_URL}/admin/config`, {
      headers: ADMIN_HEADERS,
      data: { key: 'db_version', value: 'shadow-version' },
    });
    expect(saveResponse.ok()).toBe(true);

    const versionAfterResponse = await request.get(`${WORKER_URL}/admin/db_version`, {
      headers: ADMIN_HEADERS,
    });
    expect((await versionAfterResponse.json()).current_db_version).toBe(versionBefore);
  });

  test('rejects invalid keys and non-string values', async ({ request }) => {
    const invalidKeyResponse = await request.post(`${WORKER_URL}/admin/config`, {
      headers: ADMIN_HEADERS,
      data: { key: 'invalid key', value: 'value' },
    });
    expect(invalidKeyResponse.status()).toBe(400);

    const invalidValueResponse = await request.post(`${WORKER_URL}/admin/config`, {
      headers: ADMIN_HEADERS,
      data: { key: 'valid_key', value: 1 },
    });
    expect(invalidValueResponse.status()).toBe(400);
  });
});
