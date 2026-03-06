import { test, expect } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  seedTestMail,
  deleteAddress,
} from '../../fixtures/test-helpers';

test.describe('Webhook Settings', () => {
  test('get default webhook settings returns empty/disabled', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'webhook-get');

    try {
      const res = await request.get(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(res.ok()).toBe(true);
      const settings = await res.json();
      expect(settings.enabled).toBeFalsy();
      expect(settings.url).toBe('');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('save and retrieve webhook settings', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'webhook-save');

    try {
      // Save webhook settings
      const saveRes = await request.post(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: true,
          url: 'https://example.com/webhook',
          method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ from: '${from}', subject: '${subject}' }),
        },
      });
      expect(saveRes.ok()).toBe(true);
      const saveBody = await saveRes.json();
      expect(saveBody.success).toBe(true);

      // Retrieve and verify
      const getRes = await request.get(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(getRes.ok()).toBe(true);
      const settings = await getRes.json();
      expect(settings.enabled).toBe(true);
      expect(settings.url).toBe('https://example.com/webhook');
      expect(settings.method).toBe('POST');
      expect(settings.headers).toBe(JSON.stringify({ 'Content-Type': 'application/json' }));
      expect(settings.body).toBe(JSON.stringify({ from: '${from}', subject: '${subject}' }));
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('test webhook with unreachable URL returns error', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'webhook-fail');

    try {
      // Seed a mail so the test endpoint has raw data
      await seedTestMail(request, address, {
        subject: 'Webhook Fail Test',
        from: 'sender@test.example.com',
        text: 'This webhook should fail',
      });

      // Test webhook with unreachable URL — expect non-2xx response
      const testRes = await request.post(`${WORKER_URL}/api/webhook/test`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: true,
          url: 'http://unreachable.invalid/webhook',
          method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ from: '${from}' }),
        },
      });
      expect(testRes.ok()).toBe(false);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
