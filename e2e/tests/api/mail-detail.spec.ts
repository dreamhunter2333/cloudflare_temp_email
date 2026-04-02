import { test, expect } from '@playwright/test';
import { WORKER_URL, createTestAddress, seedTestMail, deleteAddress } from '../../fixtures/test-helpers';

test.describe('Mail Detail', () => {
  test('fetch a single mail by ID', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'detail-get');

    try {
      // Seed a mail with known content
      await seedTestMail(request, address, {
        subject: 'Detail Test',
        from: 'alice@test.example.com',
        html: '<p>Hello detail</p>',
        text: 'Hello detail',
      });

      // List mails to get the ID
      const listRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(listRes.ok()).toBe(true);
      const { results } = await listRes.json();
      expect(results).toHaveLength(1);
      const mailId = results[0].id;

      // Fetch single mail by ID
      const detailRes = await request.get(`${WORKER_URL}/api/mail/${mailId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(detailRes.ok()).toBe(true);
      const mail = await detailRes.json();
      expect(mail.id).toBe(mailId);
      expect(mail.address).toBe(address);
      expect(mail.source).toBe('alice@test.example.com');
      expect(mail.raw).toContain('Detail Test');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('lists mail received via uppercase domain variant under the same mailbox', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'detail-case');

    try {
      const [localPart, domain] = address.split('@');
      const uppercaseDomainAddress = `${localPart}@${domain.toUpperCase()}`;

      await seedTestMail(request, uppercaseDomainAddress, {
        subject: 'Domain Case Test',
        from: 'alice@test.example.com',
        html: '<p>Hello case domain</p>',
        text: 'Hello case domain',
      });

      const listRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(listRes.ok()).toBe(true);

      const { results } = await listRes.json();
      expect(results).toHaveLength(1);
      expect(results[0].address).toBe(address);
      expect(results[0].raw).toContain('Domain Case Test');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('fetch non-existent mail returns null', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'detail-404');

    try {
      const res = await request.get(`${WORKER_URL}/api/mail/99999999`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body).toBeNull();
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
