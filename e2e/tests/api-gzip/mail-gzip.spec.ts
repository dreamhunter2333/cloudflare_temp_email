import { test, expect } from '@playwright/test';
import { WORKER_GZIP_URL, TEST_DOMAIN } from '../../fixtures/test-helpers';

/**
 * These tests run against a worker instance with ENABLE_MAIL_GZIP=true.
 * They verify gzip-compressed storage and backward-compatible reading.
 */

// Helper: create address on the gzip worker
async function createGzipAddress(ctx: any, name: string) {
  const uniqueName = `${name}${Date.now()}`;
  const res = await ctx.post(`${WORKER_GZIP_URL}/api/new_address`, {
    data: { name: uniqueName, domain: TEST_DOMAIN },
  });
  if (!res.ok()) throw new Error(`Failed to create address: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return { jwt: body.jwt, address: body.address, address_id: body.address_id };
}

// Helper: seed mail via receiveMail (goes through email() handler → gzip compression)
async function receiveGzipMail(
  ctx: any, address: string,
  opts: { subject?: string; html?: string; text?: string; from?: string }
) {
  const from = opts.from || `sender@${TEST_DOMAIN}`;
  const subject = opts.subject || 'Test Email';
  const boundary = `----E2E${Date.now()}`;
  const htmlPart = opts.html || `<p>${opts.text || 'Hello from E2E'}</p>`;
  const textPart = opts.text || 'Hello from E2E';
  const messageId = `<e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test>`;

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
    textPart,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlPart,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await ctx.post(`${WORKER_GZIP_URL}/admin/test/receive_mail`, {
    data: { from, to: address, raw },
  });
  if (!res.ok()) throw new Error(`Failed to receive mail: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  if (!body.success) throw new Error(`Mail was rejected: ${body.rejected || 'unknown reason'}`);
}

// Helper: seed mail via seedMail (direct INSERT → plaintext raw, no gzip)
async function seedPlaintextMail(
  ctx: any, address: string,
  opts: { subject?: string; text?: string; from?: string }
) {
  const from = opts.from || `sender@${TEST_DOMAIN}`;
  const subject = opts.subject || 'Plaintext Mail';
  const messageId = `<e2e-plain-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test>`;
  const raw = [
    `From: ${from}`,
    `To: ${address}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    opts.text || 'Hello plaintext from E2E',
  ].join('\r\n');

  const res = await ctx.post(`${WORKER_GZIP_URL}/admin/test/seed_mail`, {
    data: { address, source: from, raw, message_id: messageId },
  });
  if (!res.ok()) throw new Error(`Failed to seed mail: ${res.status()} ${await res.text()}`);
}

// Helper: delete address on gzip worker
async function deleteGzipAddress(ctx: any, jwt: string) {
  await ctx.delete(`${WORKER_GZIP_URL}/api/delete_address`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
}

test.describe('Mail Gzip Storage', () => {
  test('gzip-compressed mail is readable in list', async ({ request }) => {
    const { jwt, address } = await createGzipAddress(request, 'gzip-list');
    try {
      await receiveGzipMail(request, address, {
        subject: 'Gzip List Test',
        text: 'compressed content here',
      });

      const res = await request.get(`${WORKER_GZIP_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(res.ok()).toBe(true);
      const { results } = await res.json();
      expect(results).toHaveLength(1);
      expect(results[0].raw).toContain('Gzip List Test');
      expect(results[0].raw).toContain('compressed content here');
    } finally {
      await deleteGzipAddress(request, jwt);
    }
  });

  test('gzip-compressed mail is readable in detail', async ({ request }) => {
    const { jwt, address } = await createGzipAddress(request, 'gzip-detail');
    try {
      await receiveGzipMail(request, address, {
        subject: 'Gzip Detail Test',
        html: '<b>bold gzip</b>',
      });

      const listRes = await request.get(`${WORKER_GZIP_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const { results } = await listRes.json();
      const mailId = results[0].id;

      const detailRes = await request.get(`${WORKER_GZIP_URL}/api/mail/${mailId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(detailRes.ok()).toBe(true);
      const mail = await detailRes.json();
      expect(mail.raw).toContain('Gzip Detail Test');
      expect(mail.raw).toContain('<b>bold gzip</b>');
    } finally {
      await deleteGzipAddress(request, jwt);
    }
  });

  test('mixed: plaintext seed + gzip receive both readable in same list', async ({ request }) => {
    const { jwt, address } = await createGzipAddress(request, 'gzip-mixed');
    try {
      // 1. Direct INSERT plaintext (simulates pre-gzip data)
      await seedPlaintextMail(request, address, {
        subject: 'Old Plaintext Mail',
        text: 'legacy plain content',
      });

      // 2. receiveMail → goes through email() handler → gzip compressed
      await receiveGzipMail(request, address, {
        subject: 'New Gzip Mail',
        text: 'new compressed content',
      });

      const res = await request.get(`${WORKER_GZIP_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(res.ok()).toBe(true);
      const { results } = await res.json();
      expect(results).toHaveLength(2);

      // Both mails should have readable raw content
      const subjects = results.map((r: any) => r.raw);
      expect(subjects.some((r: string) => r.includes('Old Plaintext Mail'))).toBe(true);
      expect(subjects.some((r: string) => r.includes('New Gzip Mail'))).toBe(true);
      expect(subjects.some((r: string) => r.includes('legacy plain content'))).toBe(true);
      expect(subjects.some((r: string) => r.includes('new compressed content'))).toBe(true);
    } finally {
      await deleteGzipAddress(request, jwt);
    }
  });

  test('admin internal mail (sendAdminInternalMail) is gzip-compressed and readable', async ({ request }) => {
    const { jwt, address } = await createGzipAddress(request, 'gzip-admin-mail');
    try {
      // 1. Request send access → creates address_sender row
      const reqAccessRes = await request.post(`${WORKER_GZIP_URL}/api/request_send_mail_access`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(reqAccessRes.ok()).toBe(true);

      // 2. Get address_sender id
      const senderListRes = await request.get(
        `${WORKER_GZIP_URL}/admin/address_sender?limit=10&offset=0&address=${encodeURIComponent(address)}`,
      );
      expect(senderListRes.ok()).toBe(true);
      const senderList = await senderListRes.json();
      const senderId = senderList.results[0].id;

      // 3. Update send access via admin API → triggers sendAdminInternalMail
      const updateRes = await request.post(`${WORKER_GZIP_URL}/admin/address_sender`, {
        data: { address, address_id: senderId, balance: 99, enabled: true },
      });
      expect(updateRes.ok()).toBe(true);

      // 4. Verify the internal mail is readable
      const mailsRes = await request.get(`${WORKER_GZIP_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(mailsRes.ok()).toBe(true);
      const { results } = await mailsRes.json();
      expect(results.length).toBeGreaterThanOrEqual(1);

      // mimetext base64-encodes the Subject header, so match on body content instead
      const internalMail = results.find((m: any) => m.raw?.includes('balance: 99'));
      expect(internalMail).toBeDefined();
      expect(internalMail.raw).toContain('admin@internal');
      expect(internalMail.raw).toContain('balance: 99');
      expect(internalMail).not.toHaveProperty('raw_blob');
    } finally {
      await deleteGzipAddress(request, jwt);
    }
  });

  test('raw_blob field is not exposed in API response', async ({ request }) => {
    const { jwt, address } = await createGzipAddress(request, 'gzip-noblob');
    try {
      await receiveGzipMail(request, address, { subject: 'No Blob Leak' });

      // Check list response
      const listRes = await request.get(`${WORKER_GZIP_URL}/api/mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const { results } = await listRes.json();
      expect(results[0]).not.toHaveProperty('raw_blob');

      // Check detail response
      const detailRes = await request.get(`${WORKER_GZIP_URL}/api/mail/${results[0].id}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const mail = await detailRes.json();
      expect(mail).not.toHaveProperty('raw_blob');
    } finally {
      await deleteGzipAddress(request, jwt);
    }
  });
});
