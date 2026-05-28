import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

test.describe('Telegram AI extraction rendering', () => {
  test('realtime mail stores AI extraction metadata for Telegram rendering', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'tg-ai');

    try {
      const subject = `Telegram AI realtime ${Date.now()}`;
      const raw = [
        'From: sender@test.example.com',
        `To: ${address}`,
        `Subject: ${subject}`,
        `Message-ID: <telegram-ai-${Date.now()}@test>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Telegram AI extraction realtime body',
      ].join('\r\n');

      const receiveRes = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
        data: {
          from: 'sender@test.example.com',
          to: address,
          raw,
          ai_extract_result: {
            type: 'auth_code',
            result: '123456',
            result_text: '',
          },
        },
      });
      expect(receiveRes.ok()).toBe(true);
      const receiveBody = await receiveRes.json();
      expect(receiveBody.success).toBe(true);

      const mailsRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(mailsRes.ok()).toBe(true);
      const { results } = await mailsRes.json();
      expect(results).toHaveLength(1);

      const metadata = JSON.parse(results[0].metadata);
      expect(metadata.ai_extract).toEqual({
        type: 'auth_code',
        result: '123456',
        result_text: '',
      });
      expect(metadata.extracted_at).toBeTruthy();
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
