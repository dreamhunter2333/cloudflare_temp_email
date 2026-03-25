import { test, expect } from '@playwright/test';
import { WORKER_URL, TEST_DOMAIN } from '../../fixtures/test-helpers';

test.describe('Admin New Address', () => {
  test('should return address_id in response', async ({ request }) => {
    const uniqueName = `admin-test${Date.now()}`;
    const res = await request.post(`${WORKER_URL}/admin/new_address`, {
      data: { name: uniqueName, domain: TEST_DOMAIN },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body.address).toContain('@' + TEST_DOMAIN);
    expect(body.jwt).toBeTruthy();
    expect(body.address_id).toBeGreaterThan(0);
    expect(typeof body.address_id).toBe('number');
  });
});
