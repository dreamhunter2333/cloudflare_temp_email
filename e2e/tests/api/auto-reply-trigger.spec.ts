import { test, expect } from '@playwright/test';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  deleteAllMailpitMessages,
  onMailpitMessage,
} from '../../fixtures/test-helpers';

test.describe('Auto Reply — triggered on incoming mail', () => {
  let jwt: string;
  let address: string;

  test.beforeAll(async ({ request }) => {
    await deleteAllMailpitMessages(request);
    ({ jwt, address } = await createTestAddress(request, 'auto-reply-trigger'));

    // Configure auto-reply: source_prefix matches the sender domain
    const saveRes = await request.post(`${WORKER_URL}/api/auto_reply`, {
      headers: { Authorization: `Bearer ${jwt}` },
      data: {
        auto_reply: {
          name: 'Auto Bot',
          subject: 'Out of Office',
          source_prefix: 'sender@',
          message: 'Thanks, I will get back to you soon.',
          enabled: true,
        },
      },
    });
    expect(saveRes.ok()).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('auto-reply is sent to Mailpit when incoming mail matches source_prefix', async ({ request }) => {
    const replyListener = onMailpitMessage(
      (m) => m.Subject === 'Out of Office'
    );
    await replyListener.ready;

    // Send incoming mail via receive_mail endpoint (exercises real email handler)
    const from = `sender@test.example.com`;
    const subject = `Trigger Auto Reply ${Date.now()}`;
    const boundary = `----E2E${Date.now()}`;
    const messageId = `<auto-reply-${Date.now()}@test>`;
    const raw = [
      `From: ${from}`,
      `To: ${address}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      `Hello, are you there?`,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
      data: { from, to: address, raw },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Wait for auto-reply to arrive in Mailpit
    const reply = await replyListener.message;
    expect(reply.Subject).toBe('Out of Office');
  });

  test('auto-reply is NOT sent when sender does not match source_prefix', async ({ request }) => {
    const from = `other@test.example.com`;
    const subject = `No Reply Expected ${Date.now()}`;
    const boundary = `----E2E${Date.now()}`;
    const messageId = `<no-reply-${Date.now()}@test>`;
    const raw = [
      `From: ${from}`,
      `To: ${address}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      `This should not trigger auto-reply`,
    ].join('\r\n');

    const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
      data: { from, to: address, raw },
    });
    expect(res.ok()).toBe(true);

    // Wait briefly — no auto-reply should appear
    const listener = onMailpitMessage(
      (m) => m.Subject === 'Out of Office',
      { timeout: 3_000 }
    );
    await listener.ready;
    await expect(listener.message).rejects.toThrow();
  });
});
