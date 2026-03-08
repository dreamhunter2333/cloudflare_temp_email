import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

test.describe('Auto Reply Trigger (#459)', () => {
  /**
   * Bug #459: source_prefix empty string causes auto-reply to never trigger.
   * The old condition `results.source_prefix && ...` short-circuits when
   * source_prefix is "" (falsy). Fix: empty source_prefix should match all.
   */
  test('empty source_prefix triggers auto-reply for any sender', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'auto-reply-trigger');

    try {
      // Configure auto-reply with empty source_prefix (match all senders)
      const saveRes = await request.post(`${WORKER_URL}/api/auto_reply`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          auto_reply: {
            name: 'Auto Bot',
            subject: 'Auto Reply',
            source_prefix: '',
            message: 'Thanks for your email!',
            enabled: true,
          },
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Send a mail to the address — should trigger auto-reply
      const receiveRes = await seedTestMailWithReply(request, address, {
        from: 'anyone@other.com',
        subject: 'Hello',
        text: 'Test message',
      });
      expect(receiveRes.success).toBe(true);
      expect(receiveRes.replyCalled).toBe(true);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('source_prefix startsWith still works (backward compat)', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'auto-reply-prefix');

    try {
      const saveRes = await request.post(`${WORKER_URL}/api/auto_reply`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          auto_reply: {
            name: 'Prefix Bot',
            subject: 'Prefix Reply',
            source_prefix: 'vip@',
            message: 'VIP auto-reply',
            enabled: true,
          },
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Matching sender — should trigger
      const matchRes = await seedTestMailWithReply(request, address, {
        from: 'vip@example.com',
        subject: 'VIP mail',
      });
      expect(matchRes.replyCalled).toBe(true);

      // Non-matching sender — should NOT trigger
      const noMatchRes = await seedTestMailWithReply(request, address, {
        from: 'random@example.com',
        subject: 'Random mail',
      });
      expect(noMatchRes.replyCalled).toBe(false);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('source_prefix regex match', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'auto-reply-regex');

    try {
      // Configure regex: match senders from example.com or example.org
      const saveRes = await request.post(`${WORKER_URL}/api/auto_reply`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          auto_reply: {
            name: 'Regex Bot',
            subject: 'Regex Reply',
            source_prefix: '/@example\\.(com|org)$/',
            message: 'Regex auto-reply',
            enabled: true,
          },
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Matching sender
      const matchRes = await seedTestMailWithReply(request, address, {
        from: 'user@example.com',
        subject: 'Match test',
      });
      expect(matchRes.replyCalled).toBe(true);

      // Another matching sender
      const matchRes2 = await seedTestMailWithReply(request, address, {
        from: 'user@example.org',
        subject: 'Match test 2',
      });
      expect(matchRes2.replyCalled).toBe(true);

      // Non-matching sender
      const noMatchRes = await seedTestMailWithReply(request, address, {
        from: 'user@other.com',
        subject: 'No match test',
      });
      expect(noMatchRes.replyCalled).toBe(false);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('disabled auto-reply does not trigger', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'auto-reply-disabled');

    try {
      const saveRes = await request.post(`${WORKER_URL}/api/auto_reply`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          auto_reply: {
            name: 'Disabled Bot',
            subject: 'Should not reply',
            source_prefix: '',
            message: 'This should never be sent',
            enabled: false,
          },
        },
      });
      expect(saveRes.ok()).toBe(true);

      const receiveRes = await seedTestMailWithReply(request, address, {
        from: 'anyone@other.com',
        subject: 'Test disabled',
      });
      expect(receiveRes.success).toBe(true);
      expect(receiveRes.replyCalled).toBe(false);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});

/**
 * Send a mail via receive_mail endpoint and return the response
 * including replyCalled field.
 */
async function seedTestMailWithReply(
  ctx: APIRequestContext,
  address: string,
  opts: { from?: string; subject?: string; text?: string }
): Promise<{ success: boolean; replyCalled: boolean }> {
  const from = opts.from || 'sender@test.example.com';
  const subject = opts.subject || 'Test Email';
  const text = opts.text || 'Hello from E2E';
  const messageId = `<e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test>`;

  const raw = [
    `From: ${from}`,
    `To: ${address}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    text,
  ].join('\r\n');

  const res = await ctx.post(`${WORKER_URL}/admin/test/receive_mail`, {
    data: { from, to: address, raw },
  });
  if (!res.ok()) {
    throw new Error(`Failed to receive mail: ${res.status()} ${await res.text()}`);
  }
  return await res.json();
}
