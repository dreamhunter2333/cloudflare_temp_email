import { test, expect } from '@playwright/test';
import http from 'node:http';
import { WORKER_URL, createTestAddress, seedTestMail } from '../../fixtures/test-helpers';

test('Webhook tests support random and specified mail IDs with ownership checks', async ({ request }) => {
  const mailbox = await createTestAddress(request, 'webhookid');
  const other = await createTestAddress(request, 'webhookother');
  const headers = { Authorization: `Bearer ${mailbox.jwt}` };
  const payloads: any[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        payloads.push(JSON.parse(Buffer.concat(chunks).toString()));
        res.writeHead(200).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve));
  const port = (server.address() as import('node:net').AddressInfo).port;
  const settings = {
    enabled: true, url: `http://${process.env.CI ? 'e2e-runner' : 'localhost'}:${port}`,
    method: 'POST', headers: '{"Content-Type":"application/json"}',
    body: '{"id":"${id}","subject":"${subject}"}',
  };
  try {
    await seedTestMail(request, mailbox.address, { subject: 'First selected email' });
    await seedTestMail(request, mailbox.address, { subject: 'Second selected email' });
    const list = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, { headers });
    expect(list.ok()).toBe(true);
    const { results } = await list.json();
    expect(results).toHaveLength(2);
    const selected = results[1];
    for (const endpoint of ['/api/webhook/test', '/admin/mail_webhook/test']) {
      const count = payloads.length;
      expect((await request.post(`${WORKER_URL}${endpoint}`, { headers, data: settings })).ok()).toBe(true);
      await expect.poll(() => payloads.length).toBe(count + 1);
      if (endpoint.startsWith('/api/')) {
        expect(results.map((mail: any) => String(mail.id))).toContain(payloads[count].id);
      }
      expect((await request.post(`${WORKER_URL}${endpoint}`, {
        headers, data: { ...settings, mail_id: Number(selected.id) },
      })).ok()).toBe(true);
      await expect.poll(() => payloads.length).toBe(count + 2);
      expect(payloads[count + 1].id).toBe(String(selected.id));
      for (const mail_id of [0, -1, 1.5, '1', null]) {
        expect((await request.post(`${WORKER_URL}${endpoint}`, {
          headers, data: { ...settings, mail_id },
        })).status()).toBe(400);
      }
      expect((await request.post(`${WORKER_URL}${endpoint}`, {
        headers, data: { ...settings, mail_id: Number.MAX_SAFE_INTEGER },
      })).status()).toBe(404);
      expect(payloads).toHaveLength(count + 2);
      for (const [lang, invalid, missing] of [
        ['zh', '无效的邮件 ID', '邮件不存在'],
        ['en', 'Invalid mail ID', 'Mail not found'],
      ]) {
        for (const body of ['null', '[]', '1', 'true', '"text"', '{', '']) {
          const response = await request.post(`${WORKER_URL}${endpoint}`, {
            headers: { ...headers, 'x-lang': lang, 'Content-Type': 'application/json' },
            data: body,
          });
          expect(response.status()).toBe(400);
          expect(await response.text()).toBe(lang === 'zh' ? '无效的请求体' : 'Invalid request body');
        }
        for (const [mail_id, status, message] of [[0, 400, invalid], [999999999, 404, missing]] as const) {
          const response = await request.post(`${WORKER_URL}${endpoint}`, {
            headers: { ...headers, 'x-lang': lang }, data: { ...settings, mail_id },
          });
          expect(response.status()).toBe(status);
          expect(await response.text()).toBe(message);
        }
      }
      expect(payloads).toHaveLength(count + 2);
    }
    const count = payloads.length;
    expect((await request.post(`${WORKER_URL}/api/webhook/test`, {
      headers: { Authorization: `Bearer ${other.jwt}` },
      data: { ...settings, mail_id: Number(selected.id) },
    })).status()).toBe(404);
    expect(payloads).toHaveLength(count);
  } finally {
    await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
    await request.delete(`${WORKER_URL}/admin/delete_address/${other.address_id}`);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
