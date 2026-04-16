import { test, expect } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  requestSendAccess,
  deleteAddress,
  getAddressSender,
  updateAddressSender,
} from '../../fixtures/test-helpers';

test.describe('Send Access', () => {
  test('request send access stays idempotent when default balance is auto-initialized', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'send-access');

    try {
      // First request — should succeed even if balance will also auto-init elsewhere.
      await requestSendAccess(request, jwt);

      // Verify balance is set via settings
      const settingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(settingsRes.ok()).toBe(true);
      const settings = await settingsRes.json();
      expect(settings.send_balance).toBe(10);

      // Duplicate request should stay safe and idempotent.
      const dupRes = await request.post(`${WORKER_URL}/api/request_send_mail_access`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(dupRes.ok()).toBe(true);

      const sender = await getAddressSender(request, address);
      expect(sender.balance).toBe(10);
      expect(sender.enabled).toBe(1);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('settings repairs old disabled zero-balance sender rows', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'send-access-repair');

    try {
      await requestSendAccess(request, jwt);

      const sender = await getAddressSender(request, address);
      await updateAddressSender(request, {
        address,
        address_id: sender.id,
        balance: 0,
        enabled: false,
      });

      const settingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(settingsRes.ok()).toBe(true);
      const settings = await settingsRes.json();
      expect(settings.send_balance).toBe(10);

      const repairedSender = await getAddressSender(request, address);
      expect(repairedSender.balance).toBe(10);
      expect(repairedSender.enabled).toBe(1);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
