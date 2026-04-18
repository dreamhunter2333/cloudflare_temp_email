import { test, expect } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  requestSendAccess,
  deleteAddress,
  deleteAddressSender,
  getAddressSender,
  resetSenderToLegacy,
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

  test('settings repairs legacy (source IS NULL) disabled zero-balance rows', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'send-access-legacy');

    try {
      await requestSendAccess(request, jwt);

      // Simulate a pre-migration row: disabled, zero balance, no source tag.
      await resetSenderToLegacy(request, address);

      const settingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(settingsRes.ok()).toBe(true);
      const settings = await settingsRes.json();
      expect(settings.send_balance).toBe(10);

      const repairedSender = await getAddressSender(request, address);
      expect(repairedSender.balance).toBe(10);
      expect(repairedSender.enabled).toBe(1);
      // Legacy rows graduate into the 'auto' lifecycle after repair.
      expect(repairedSender.source).toBe('auto');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('admin-disabled rows are not overwritten by settings or send', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'sa-admin-blocked');

    try {
      await requestSendAccess(request, jwt);

      const sender = await getAddressSender(request, address);
      await updateAddressSender(request, {
        address,
        address_id: sender.id,
        balance: 0,
        enabled: false,
      });

      // Reading settings must not auto-repair an admin-disabled row.
      const settingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(settingsRes.ok()).toBe(true);
      const settings = await settingsRes.json();
      expect(settings.send_balance).toBe(0);

      const stillDisabled = await getAddressSender(request, address);
      expect(stillDisabled.balance).toBe(0);
      expect(stillDisabled.enabled).toBe(0);
      expect(stillDisabled.source).toBe('admin');

      // Attempting to send must also fail and must not auto-repair the row.
      const sendRes = await request.post(`${WORKER_URL}/api/send_mail`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          from_name: 'E2E',
          to_name: 'E2E',
          to_mail: 'recipient@test.example.com',
          subject: 'should not send',
          content: 'body',
          is_html: false,
        },
      });
      expect(sendRes.ok()).toBe(false);

      const afterSend = await getAddressSender(request, address);
      expect(afterSend.balance).toBe(0);
      expect(afterSend.enabled).toBe(0);
      expect(afterSend.source).toBe('admin');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('send after admin deletion auto-initializes a fresh sender row', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'send-access-deleted');

    try {
      await requestSendAccess(request, jwt);

      const sender = await getAddressSender(request, address);
      await deleteAddressSender(request, sender.id);

      const sendRes = await request.post(`${WORKER_URL}/api/send_mail`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          from_name: 'E2E',
          to_name: 'E2E',
          to_mail: 'recipient@test.example.com',
          subject: `E2E reinit ${Date.now()}`,
          content: 'body',
          is_html: false,
        },
      });
      expect(sendRes.ok()).toBe(true);

      // A new row should exist, tagged 'auto', with balance decremented by 1.
      const recreated = await getAddressSender(request, address);
      expect(recreated.enabled).toBe(1);
      expect(recreated.balance).toBe(9);
      expect(recreated.source).toBe('auto');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('request send access does not falsely succeed when quota is already exhausted', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'sendexh');

    try {
      await requestSendAccess(request, jwt);

      const sender = await getAddressSender(request, address);
      await updateAddressSender(request, {
        address,
        address_id: sender.id,
        balance: 0,
        enabled: true,
      });

      const retryRes = await request.post(`${WORKER_URL}/api/request_send_mail_access`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(retryRes.status()).toBe(400);
      const retryBody = await retryRes.text();
      expect(retryBody).toContain('Already');
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
