import { test, expect } from '@playwright/test';
import {
  createTestAddress,
  deleteAddress,
  deleteAllMailpitMessages,
  requestSendAccess,
  onMailpitMessage,
  WORKER_URL,
} from '../../fixtures/test-helpers';

test.describe('Send Mail via SMTP', () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllMailpitMessages(request);
  });

  test('send HTML email and verify in Mailpit', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'sender-test');

    // Must request send access before sending (creates address_sender row)
    await requestSendAccess(request, jwt);

    const subject = `E2E Test ${Date.now()}`;
    const htmlContent = '<h1>Hello</h1><p>This is an <b>E2E test</b> email.</p>';

    // Start listening for the message BEFORE sending
    const listener = onMailpitMessage((m) => m.Subject === subject);
    await listener.ready;

    // Send mail via worker API
    const sendRes = await request.post(`${WORKER_URL}/api/send_mail`, {
      headers: { Authorization: `Bearer ${jwt}` },
      data: {
        from_name: 'E2E Sender',
        to_name: 'E2E Recipient',
        to_mail: 'recipient@test.example.com',
        subject,
        content: htmlContent,
        is_html: true,
      },
    });
    expect(sendRes.ok()).toBe(true);

    // Wait for Mailpit WebSocket "new" event — no polling
    const mail = await listener.message;
    expect(mail.From.Address).toBe(address);
    expect(mail.To[0].Address).toBe('recipient@test.example.com');

    // Cleanup
    await deleteAddress(request, jwt);
  });
});
