import { expect, test } from '@playwright/test';

import {
  WORKER_URL,
  WORKER_URL_ENV_OFF,
  createTestAddress,
  deleteAddress,
  seedTestMail,
} from '../../fixtures/test-helpers';

const headers = (jwt: string) => ({ Authorization: `Bearer ${jwt}` });

test.describe('Mail read status', () => {
  test('keeps historical mail read and switches one new mail state', async ({ request }) => {
    const mailbox = await createTestAddress(request, 'mail-read');
    try {
      const historical = await request.post(`${WORKER_URL}/admin/test/seed_mail`, {
        data: {
          address: mailbox.address,
          source: 'sender@test.example.com',
          raw: 'From: sender@test.example.com\r\nSubject: Historical\r\n\r\nHistorical',
        },
      });
      expect(historical.ok()).toBe(true);
      await seedTestMail(request, mailbox.address, { subject: 'New unread mail' });

      const list = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: headers(mailbox.jwt),
      });
      const mails = (await list.json()).results;
      expect(mails.find((mail: any) => mail.raw.includes('Historical')).is_unread).toBeNull();
      const unreadMail = mails.find((mail: any) => mail.raw.includes('New unread mail'));
      expect(unreadMail.is_unread).toBe(1);

      const markRead = await request.patch(`${WORKER_URL}/api/mails/${unreadMail.id}/read`, {
        headers: headers(mailbox.jwt),
        data: { isUnread: false },
      });
      expect((await markRead.json()).success).toBe(true);

      const updated = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: headers(mailbox.jwt),
      });
      const updatedMail = (await updated.json()).results.find((mail: any) => mail.id === unreadMail.id);
      expect(updatedMail.is_unread).toBe(0);

      const markUnread = await request.patch(`${WORKER_URL}/api/mails/${unreadMail.id}/read`, {
        headers: headers(mailbox.jwt),
        data: { isUnread: true },
      });
      expect((await markUnread.json()).success).toBe(true);

      const restored = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: headers(mailbox.jwt),
      });
      const restoredMail = (await restored.json()).results.find((mail: any) => mail.id === unreadMail.id);
      expect(restoredMail.is_unread).toBe(1);

      const invalid = await request.patch(`${WORKER_URL}/api/mails/${unreadMail.id}/read`, {
        headers: headers(mailbox.jwt),
        data: { isUnread: 'yes' },
      });
      expect(invalid.status()).toBe(400);
    } finally {
      await deleteAddress(request, mailbox.jwt);
    }
  });

  test('scopes the update and keeps disabled instances unchanged', async ({ request }) => {
    const first = await createTestAddress(request, 'mail-read-first');
    const second = await createTestAddress(request, 'mail-read-second');
    try {
      await seedTestMail(request, second.address, { subject: 'Second mail' });
      const secondList = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: headers(second.jwt),
      });
      const secondMail = (await secondList.json()).results[0];

      await request.patch(`${WORKER_URL}/api/mails/${secondMail.id}/read`, {
        headers: headers(first.jwt),
        data: { isUnread: false },
      });
      const unchanged = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: headers(second.jwt),
      });
      expect((await unchanged.json()).results[0].is_unread).toBe(1);

      const disabledMailbox = await createTestAddress(
        request,
        'mail-read-disabled',
        'test.example.com',
        WORKER_URL_ENV_OFF,
      );
      const oldList = await request.get(`${WORKER_URL_ENV_OFF}/api/mails?limit=10&offset=0`, {
        headers: headers(disabledMailbox.jwt),
      });
      expect(oldList.ok()).toBe(true);
      const disabledUpdate = await request.patch(`${WORKER_URL_ENV_OFF}/api/mails/1/read`, {
        headers: headers(disabledMailbox.jwt),
        data: { isUnread: false },
      });
      expect(disabledUpdate.status()).toBe(403);
    } finally {
      await deleteAddress(request, first.jwt);
      await deleteAddress(request, second.jwt);
    }
  });
});
