import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress, requestSendAccess, deleteAddress } from '../../fixtures/test-helpers';

test.describe('Send Access', () => {
  test('request send access succeeds once, duplicate returns 400', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'send-access');

    try {
      // First request — should succeed
      await requestSendAccess(request, jwt);

      // Verify balance is set via settings
      const settingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(settingsRes.ok()).toBe(true);
      const settings = await settingsRes.json();
      expect(settings.send_balance).toBe(10);

      // Duplicate request — should fail with 400
      const dupRes = await request.post(`${WORKER_URL}/api/requset_send_mail_access`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(dupRes.status()).toBe(400);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
