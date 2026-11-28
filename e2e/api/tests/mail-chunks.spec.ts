import { randomBytes } from 'node:crypto';
import { test, expect, APIRequestContext } from '@playwright/test';
import { WORKER_URL, WORKER_GZIP_URL, TEST_DOMAIN, createTestAddress } from '../../fixtures/test-helpers';

// Mail larger than the 1,000,000-byte chunk size is stored in raw_mail_chunks.
// Local D1 does not enforce the 2,000,000-byte row limit, so these tests check
// the stored chunks, the API responses and deletion rather than a D1 error.

const largeMail = (address: string, body: string) => [
  `From: sender@${TEST_DOMAIN}`,
  `To: ${address}`,
  'Subject: Large mail',
  `Message-ID: <e2e-large-${Date.now()}-${randomBytes(4).toString('hex')}@test>`,
  'Content-Type: text/plain; charset=utf-8',
  '',
  body,
].join('\r\n');

async function receiveMail(ctx: APIRequestContext, workerUrl: string, address: string, raw: string) {
  const res = await ctx.post(`${workerUrl}/__test/receive_mail`, {
    data: { from: `sender@${TEST_DOMAIN}`, to: address, raw },
  });
  expect(res.ok()).toBe(true);
  expect((await res.json()).success).toBe(true);
}

async function latestMail(ctx: APIRequestContext, workerUrl: string, jwt: string) {
  const res = await ctx.get(`${workerUrl}/api/mails?limit=10&offset=0`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(res.ok()).toBe(true);
  const { results } = await res.json();
  expect(results).toHaveLength(1);
  return results[0];
}

async function chunks(ctx: APIRequestContext, workerUrl: string, query: string) {
  const res = await ctx.get(`${workerUrl}/__test/raw_mail_chunks?${query}`);
  expect(res.ok()).toBe(true);
  return res.json() as Promise<{ chunk_key: string | null; count: number }>;
}

test.describe('Large mail chunks', () => {
  test('large plaintext mail is read back unchanged and its chunks are deleted with it', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'chunk-plain');
    // 1.47 MB: over the chunk size, under the 2 MiB at which this worker rebuilds mail without attachments
    const raw = largeMail(address, '大型郵件內容，'.repeat(70_000));
    await receiveMail(request, WORKER_URL, address, raw);

    const listed = await latestMail(request, WORKER_URL, jwt);
    expect(listed.raw).toBe(raw);
    expect(listed).not.toHaveProperty('raw_chunk_key');
    const stored = await chunks(request, WORKER_URL, `mail_id=${listed.id}`);
    expect(stored.count).toBe(2);

    const detailRes = await request.get(`${WORKER_URL}/api/mail/${listed.id}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(detailRes.ok()).toBe(true);
    expect((await detailRes.json()).raw).toBe(raw);

    const deleteRes = await request.delete(`${WORKER_URL}/api/mails/${listed.id}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(deleteRes.ok()).toBe(true);
    expect((await chunks(request, WORKER_URL, `chunk_key=${stored.chunk_key}`)).count).toBe(0);
  });

  test('small mail is still stored in one row', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'chunk-small');
    await receiveMail(request, WORKER_URL, address, largeMail(address, 'small body'));
    const listed = await latestMail(request, WORKER_URL, jwt);
    expect((await chunks(request, WORKER_URL, `mail_id=${listed.id}`)).chunk_key).toBeNull();
  });

  test('gzip: incompressible large mail is chunked and deleting the address removes the chunks', async ({ request }) => {
    test.skip(!WORKER_GZIP_URL, 'WORKER_GZIP_URL is not configured');
    const { jwt, address } = await createTestAddress(request, 'chunk-gzip', TEST_DOMAIN, WORKER_GZIP_URL);
    const raw = largeMail(address, randomBytes(2_400_000).toString('base64'));
    await receiveMail(request, WORKER_GZIP_URL, address, raw);

    const listed = await latestMail(request, WORKER_GZIP_URL, jwt);
    expect(listed.raw).toBe(raw);
    const stored = await chunks(request, WORKER_GZIP_URL, `mail_id=${listed.id}`);
    expect(stored.count).toBe(3);

    const deleteRes = await request.delete(`${WORKER_GZIP_URL}/api/delete_address`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(deleteRes.ok()).toBe(true);
    expect((await chunks(request, WORKER_GZIP_URL, `chunk_key=${stored.chunk_key}`)).count).toBe(0);
  });
});
