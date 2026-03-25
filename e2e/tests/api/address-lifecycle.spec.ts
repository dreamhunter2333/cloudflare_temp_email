import { test, expect } from '@playwright/test';
import { WORKER_URL, TEST_DOMAIN, createTestAddress, deleteAddress, requestSendAccess } from '../../fixtures/test-helpers';

test.describe('Address Lifecycle', () => {
  test('create address, request send access, fetch settings, then delete', async ({ request }) => {
    // Create address
    const { jwt, address, address_id } = await createTestAddress(request, 'lifecycle-test');
    expect(address).toContain('@' + TEST_DOMAIN);
    expect(jwt).toBeTruthy();
    expect(address_id).toBeGreaterThan(0);

    // Request send access (creates address_sender row with DEFAULT_SEND_BALANCE)
    await requestSendAccess(request, jwt);

    // Fetch address settings — balance should match DEFAULT_SEND_BALANCE=10
    const settingsRes = await request.get(`${WORKER_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(settingsRes.ok()).toBe(true);
    const settings = await settingsRes.json();
    expect(settings.send_balance).toBe(10);

    // Delete address
    await deleteAddress(request, jwt);

    // Verify address is gone — settings should fail
    const afterDelete = await request.get(`${WORKER_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(afterDelete.ok()).toBe(false);
  });
});
