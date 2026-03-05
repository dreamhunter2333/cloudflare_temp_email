import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

test.describe('Auto Reply Settings', () => {
  test('get empty, save, then verify saved settings', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'auto-reply');

    try {
      // GET auto_reply — should return empty object for new address
      const emptyRes = await request.get(`${WORKER_URL}/api/auto_reply`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(emptyRes.ok()).toBe(true);
      const empty = await emptyRes.json();
      expect(Object.keys(empty)).toHaveLength(0);

      // POST save auto_reply settings
      const saveRes = await request.post(`${WORKER_URL}/api/auto_reply`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          auto_reply: {
            name: 'Test Bot',
            subject: 'Auto Reply',
            source_prefix: 'Re:',
            message: 'Thanks for your email!',
            enabled: true,
          },
        },
      });
      expect(saveRes.ok()).toBe(true);
      const saveBody = await saveRes.json();
      expect(saveBody.success).toBe(true);

      // GET auto_reply — should return saved settings
      const savedRes = await request.get(`${WORKER_URL}/api/auto_reply`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(savedRes.ok()).toBe(true);
      const saved = await savedRes.json();
      expect(saved.name).toBe('Test Bot');
      expect(saved.subject).toBe('Auto Reply');
      expect(saved.source_prefix).toBe('Re:');
      expect(saved.message).toBe('Thanks for your email!');
      expect(saved.enabled).toBe(true);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('save with too long subject returns 400', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'auto-reply-long');

    try {
      const saveRes = await request.post(`${WORKER_URL}/api/auto_reply`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          auto_reply: {
            subject: 'x'.repeat(256),
            message: 'Hello',
            enabled: true,
          },
        },
      });
      expect(saveRes.status()).toBe(400);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
