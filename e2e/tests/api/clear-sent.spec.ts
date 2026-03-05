import { test, expect } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  deleteAllMailpitMessages,
  requestSendAccess,
  onMailpitMessage,
} from '../../fixtures/test-helpers';

test.describe('Clear Sent Items', () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllMailpitMessages(request);
  });

  test('send mail then clear sent items', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'clear-sent');
    await requestSendAccess(request, jwt);

    try {
      const subject = `Clear Sent Test ${Date.now()}`;

      // Listen before sending
      const listener = onMailpitMessage((m) => m.Subject === subject);
      await listener.ready;

      // Send a mail
      const sendRes = await request.post(`${WORKER_URL}/api/send_mail`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          from_name: 'Sender',
          to_name: 'Recipient',
          to_mail: 'recipient@test.example.com',
          subject,
          content: '<p>test</p>',
          is_html: true,
        },
      });
      expect(sendRes.ok()).toBe(true);
      await listener.message;

      // Verify sendbox has 1 item
      const listRes = await request.get(`${WORKER_URL}/api/sendbox?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(listRes.ok()).toBe(true);
      const { results } = await listRes.json();
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Clear sent items
      const clearRes = await request.delete(`${WORKER_URL}/api/clear_sent_items`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(clearRes.ok()).toBe(true);
      const clearBody = await clearRes.json();
      expect(clearBody.success).toBe(true);

      // Verify sendbox is empty
      const afterRes = await request.get(`${WORKER_URL}/api/sendbox?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(afterRes.ok()).toBe(true);
      const after = await afterRes.json();
      expect(after.results).toHaveLength(0);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
