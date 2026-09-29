import { test, expect } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WORKER_URL, createTestAddress } from '../../fixtures/test-helpers';

test('Webhook filter: incoming mail, selected-mail tests, isolation and compatibility', async ({ request }) => {
  const mailbox = await createTestAddress(request, 'filter');
  const other = await createTestAddress(request, 'filterother');
  const headers = { Authorization: `Bearer ${mailbox.jwt}` };
  const adminSettings = await (await request.get(`${WORKER_URL}/admin/mail_webhook/settings`)).json();
  const received: { path: string; body: any }[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      received.push({ path: req.url!, body: JSON.parse(Buffer.concat(chunks).toString()) });
      res.writeHead(200).end();
    });
  });
  await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve));
  const url = `http://${process.env.CI ? 'e2e-runner' : 'localhost'}:${(server.address() as AddressInfo).port}`;
  const settings = {
    enabled: true, url: `${url}/user`, method: 'POST', headers: '{"Content-Type":"application/json"}',
    body: '{"text":"${subject}\\n${parsedText}","from":"${from}","to":"${to}"}',
  };
  const filter = {
    operator: 'and', children: [
      { field: 'from', operator: 'equals', value: 'second@example.com' },
      { operator: 'or', children: [
        { field: 'subject', operator: 'regex', value: '^down\\b', options: { flags: 'i' } },
        { field: 'subject', operator: 'contains', value: '告警' },
      ] },
      { operator: 'not', children: [{ field: 'text', operator: 'contains', value: 'maintenance' }] },
      { field: 'to', operator: 'equals', value: mailbox.address },
      { field: 'header.X-Category', operator: 'equals', value: 'critical' },
    ],
  };
  const save = async (data: any, admin = false) => {
    const response = await request.post(`${WORKER_URL}${admin ? '/admin/mail_webhook/settings' : '/api/webhook/settings'}`, { headers, data });
    expect(response.ok(), await response.text()).toBe(true);
  };
  const deliver = async (subject: string, body: string) => {
    const response = await request.post(`${WORKER_URL}/__test/receive_mail`, {
      data: { from: 'bounce@transport.example.com', to: mailbox.address, raw: [
        'From: "Sender, Display" <first@example.com>,', ' second@example.com',
        'Sender: first@example.com', `To: different@example.com`, `Subject: ${subject}`,
        'X-Category: routine', 'X-Category: critical', 'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8', '', body,
      ].join('\r\n') },
    });
    expect(response.ok()).toBe(true);
    expect((await response.json()).success).toBe(true);
  };
  try {
    await save({ enabled: false }, true);
    await save({ ...settings, filter });
    expect((await (await request.get(`${WORKER_URL}/api/webhook/settings`, { headers })).json()).filter).toEqual(filter);
    await deliver('DOWN service', 'Service is unavailable');
    expect(received).toHaveLength(1);
    await deliver('UP service', 'Recovered');
    await deliver('DOWN service', 'Scheduled MAINTENANCE');
    expect(received).toHaveLength(1);
    await deliver('故障告警 "quoted"', 'First line\nSecond "line"');
    expect(received).toHaveLength(2);
    expect(received[1].body.text).toContain('Second "line"');
    const list = await (await request.get(`${WORKER_URL}/api/mails?limit=20&offset=0`, { headers })).json();
    expect(list.results).toHaveLength(4); // Filtering never drops stored mail.
    const mail_id = Number(list.results[0].id);
    for (const endpoint of ['/api/webhook/test', '/admin/mail_webhook/test']) {
      const before = received.length;
      const check = await request.post(`${WORKER_URL}${endpoint}`, { headers, data: { ...settings, filter, mail_id, check_only: true } });
      expect(check.ok(), await check.text()).toBe(true);
      expect(await check.json()).toMatchObject({ matched: true, skipped: true });
      expect(received).toHaveLength(before);
      const mismatch = await request.post(`${WORKER_URL}${endpoint}`, { headers, data: {
        ...settings, mail_id, filter: { field: 'subject', operator: 'equals', value: 'never' },
      } });
      expect(await mismatch.json()).toMatchObject({ matched: false, skipped: true });
      expect(received).toHaveLength(before);
      expect((await request.post(`${WORKER_URL}${endpoint}`, { headers, data: { ...settings, filter, mail_id } })).ok()).toBe(true);
      expect(received).toHaveLength(before + 1);
      expect(received.at(-1)!.body.to).toBe(mailbox.address);
      // Test from the stored envelope, not the display name or header From.
      const envelope = await request.post(`${WORKER_URL}${endpoint}`, { headers, data: {
        ...settings, mail_id, check_only: true,
        filter: { field: 'envelopeFrom', operator: 'equals', value: 'bounce@transport.example.com' },
      } });
      expect(await envelope.json()).toMatchObject({ matched: true, skipped: true });
    }
    const before = received.length;
    expect((await request.post(`${WORKER_URL}/api/webhook/test`, {
      headers: { Authorization: `Bearer ${other.jwt}` }, data: { ...settings, filter, mail_id, check_only: true },
    })).status()).toBe(404);
    expect((await request.post(`${WORKER_URL}/api/webhook/test`, {
      headers: { Authorization: `Bearer ${other.jwt}` }, data: { ...settings, filter },
    })).status()).toBe(404);
    expect(received).toHaveLength(before);
    // An admin filter doesn't gate the mailbox webhook (and vice versa).
    await save({ ...settings, url: `${url}/admin`, filter: { field: 'subject', operator: 'equals', value: 'UP service' } }, true);
    await deliver('DOWN service', 'Incident');
    expect(received.at(-1)!.path).toBe('/user');
    expect(received).toHaveLength(before + 1);
    await deliver('UP service', 'Recovered');
    expect(received.at(-1)!.path).toBe('/admin');
    expect(received).toHaveLength(before + 2);
    await save({ enabled: false }, true);
    for (const oldSettings of [settings, { ...settings, filter: null }]) {
      await save(oldSettings);
      const count = received.length;
      await deliver('UP service', 'maintenance');
      expect(received).toHaveLength(count + 1);
    }
  } finally {
    await request.post(`${WORKER_URL}/admin/mail_webhook/settings`, { data: adminSettings });
    await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
    await request.delete(`${WORKER_URL}/admin/delete_address/${other.address_id}`);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('Webhook filter rejects invalid configuration without replacing saved settings', async ({ request }) => {
  const mailbox = await createTestAddress(request, 'filterinvalid');
  const headers = { Authorization: `Bearer ${mailbox.jwt}`, 'x-lang': 'en' };
  const adminSettings = await (await request.get(`${WORKER_URL}/admin/mail_webhook/settings`)).json();
  const original = { enabled: false, url: 'https://example.invalid', method: 'POST', headers: '{}', body: '{}' };
  const invalid = [
    {}, false, [], { operator: 'and', children: [] },
    { field: 'unknown', operator: 'equals', value: '' },
    { field: 'subject', operator: 'unknown', value: '' },
    { field: 'subject', operator: 'regex', value: '[' },
    { field: 'subject', operator: 'regex', value: 'x', options: { flags: 'g' } },
    { operator: 'not', children: [] },
    { operator: 'or', children: [{ field: 'subject', operator: 'contains', value: '' }, { operator: 'broken' }] },
  ];
  try {
    for (const base of ['/api/webhook', '/admin/mail_webhook']) {
      expect((await request.post(`${WORKER_URL}${base}/settings`, { headers, data: original })).ok()).toBe(true);
      for (const filter of invalid) {
        for (const action of ['settings', 'test']) {
          const response = await request.post(`${WORKER_URL}${base}/${action}`, { headers, data: { ...original, filter } });
          expect(response.status()).toBe(400);
          expect(await response.text()).toContain('Invalid filter');
        }
      }
      expect(await (await request.get(`${WORKER_URL}${base}/settings`, { headers })).json()).toEqual(original);
      const zh = await request.post(`${WORKER_URL}${base}/test`, {
        headers: { ...headers, 'x-lang': 'zh' }, data: { ...original, filter: {} },
      });
      expect(await zh.text()).toContain('无效的过滤规则');
      expect((await request.post(`${WORKER_URL}${base}/test`, { headers, data: { ...original, check_only: 'true' } })).status()).toBe(400);
    }
  } finally {
    await request.post(`${WORKER_URL}/admin/mail_webhook/settings`, { data: adminSettings });
    await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
  }
});
