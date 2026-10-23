import { test, expect } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import PostalMime from 'postal-mime';
import { parse_message } from '../../../mail-parser-wasm/target/test-packages/browser/package/mail_parser_wasm.js';
import { createTestAddress } from '../../fixtures/test-helpers';

const binary = Buffer.from([137, 80, 78, 71, 0, 127, 128, 255]);
const makeMail = (from: string[], large = false) => [
  ...from, 'To: Team: first@example.com, second@example.com;',
  'Reply-To: reply@example.com', 'Subject: =?UTF-8?B?5rWL6K+V?=',
  `Message-ID: <${randomUUID()}@test>`, 'Date: Fri, 23 Oct 2026 12:00:00 +0800',
  'X-Empty:', 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary=mixed', '',
  '--mixed', 'Content-Type: multipart/alternative; boundary=body', '',
  '--body', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '',
  Buffer.from('正文 "quoted" \\path $&').toString('base64'),
  '--body', 'Content-Type: text/html; charset=utf-8', '', '<p>正文 "quoted" \\path $&</p>', '--body--',
  '--mixed', 'Content-Type: image/png', 'Content-Disposition: attachment; filename="image.png"',
  'Content-Transfer-Encoding: base64', '', binary.toString('base64'),
  '--mixed', 'Content-Type: application/octet-stream', 'Content-Disposition: attachment; filename="file.bin"',
  'Content-Transfer-Encoding: base64', '', binary.toString('base64'), '--mixed--',
  ...(large ? [' '.repeat(2 * 1024 * 1024)] : []),
].join('\r\n');

test.beforeAll(async ({ request }) => {
  expect((await request.post('/admin/db_initialize')).ok()).toBe(true);
  expect((await request.post('/admin/db_migration')).ok()).toBe(true);
});

for (const [name, from] of [
  ['folded encoded From', ['From: =?UTF-8?B?5rWL6K+V?=\r\n <sender@example.com>']],
  ['repeated From', ['From: First <first@example.com>', 'From: Last <last@example.com>']],
  ['multiple addresses', ['From: First <first@example.com>, Last <last@example.com>']],
  ['group', ['From: Team: first@example.com, last@example.com;']],
  ['invalid From', ['From: invalid']],
  ['empty From', ['From:']],
  ['missing From', []],
] as const) {
  test(`both packaged libraries preserve raw headers: ${name}`, async ({ request }) => {
    const raw = makeMail([...from]);
    const response = await request.post('/__test/wasm_parse', { data: raw });
    expect(response.ok()).toBe(true);
    const worker = await response.json();
    const parsed = parse_message(raw);
    expect({
      sender: parsed.sender, subject: parsed.subject, text: parsed.text, html: parsed.body_html,
      headers: parsed.headers.map(header => ({ key: header.key.toLowerCase(), value: header.value })),
      attachments: parsed.attachments.map(file => ({
        filename: file.filename, content: [...file.content], content_type: file.content_type,
      })),
    }).toEqual(worker);
    expect(worker.headers.filter((header: any) => header.key === 'from').map((header: any) => header.value))
      .toEqual(from.map(value => value.slice('From:'.length).trim()));
    for (const [key, value] of [
      ['to', 'Team: first@example.com, second@example.com;'], ['reply-to', 'reply@example.com'],
      ['date', 'Fri, 23 Oct 2026 12:00:00 +0800'], ['subject', '测试'],
      ['content-type', 'multipart/mixed; boundary=mixed'], ['x-empty', ''],
    ]) expect(worker.headers).toContainEqual({ key, value });
    expect(worker.subject).toBe('测试');
    expect(worker.text.trim()).toBe('正文 "quoted" \\path $&');
    expect(worker.html.trim()).toBe('<p>正文 "quoted" \\path $&</p>');
    expect(worker.attachments).toEqual([
      { filename: 'image.png', content: [...binary], content_type: 'image/png' },
      { filename: 'file.bin', content: [...binary], content_type: 'application/octet-stream' },
    ]);
  });
}

test('both packages decode HTML entities in generated plain text', async ({ request }) => {
  const raw = 'From: Sender <sender@example.com>\r\nSubject: Entities\r\nContent-Type: text/html; charset=utf-8\r\n\r\n'
    + '<p>A&nbsp;B &amp; C &copy; &#160; &#xA0;</p>';
  const response = await request.post('/__test/wasm_parse', { data: raw });
  expect(response.ok()).toBe(true);
  const parsed = await response.json();
  expect(parsed.text.trim()).toBe('A\u00a0B & C ©');
  expect(parse_message(raw).text).toBe(parsed.text);
});

for (const [charset, body, expected] of [
  ['shift_jis', 'k/qWe4zqgsyWe5W2', '日本語の本文'],
  ['gb18030', '1tDOxNX9zsQ=', '中文正文'],
] as const) {
  test(`both packages preserve ${charset} body decoding`, async ({ request }) => {
    const raw = `From: sender@example.com\r\nSubject: Charset\r\nContent-Type: text/plain; charset=${charset}\r\n`
      + `Content-Transfer-Encoding: base64\r\n\r\n${body}`;
    const response = await request.post('/__test/wasm_parse', { data: raw });
    expect(response.ok()).toBe(true);
    expect((await response.json()).text).toBe(expected);
    expect(parse_message(raw).text).toBe(expected);
  });
}

test('real receive, raw-header filters, stored From and attachment downloads', async ({ request, baseURL }, info) => {
  test.setTimeout(60_000);
  const mailbox = await createTestAddress(request, 'wasm', undefined, baseURL);
  const headers = { Authorization: `Bearer ${mailbox.jwt}` };
  const received: { path: string; body: any }[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      received.push({ path: req.url!, body: JSON.parse(Buffer.concat(chunks).toString()) });
      res.writeHead(200).end();
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const filter = { operator: 'and', children: [
      { field: 'header.From', operator: 'contains', value: 'sender@example.com' },
      { field: 'header.Subject', operator: 'equals', value: '测试' },
    ] };
    const settings = {
      enabled: true, method: 'POST', headers: '{"Content-Type":"application/json"}', filter,
      body: '{"id":"${id}","from":"${from}","text":"${parsedText}","attachments":${attachments}}',
    };
    for (const [endpoint, scope] of [['/api/webhook/settings', '/user'], ['/admin/mail_webhook/settings', '/admin']]) {
      const saved = await request.post(endpoint, { headers, data: { ...settings, url: url + scope } });
      expect(saved.ok(), await saved.text()).toBe(true);
    }
    for (const large of [false, true]) {
      const raw = makeMail(['From: =?UTF-8?B?5rWL6K+V?=\r\n <sender@example.com>'], large);
      const original = await (await request.post('/__test/wasm_parse', { data: raw })).json();
      const count = received.length;
      const delivered = await request.post('/__test/receive_mail', {
        data: { from: 'bounce@transport.example', to: mailbox.address, raw },
      });
      expect(delivered.ok()).toBe(true);
      expect((await delivered.json()).success).toBe(true);
      await expect.poll(() => received.length).toBe(count + 2);
      const remove = large || info.project.name === 'remove-all';
      for (const message of received.slice(count)) {
        expect(message.body.from).toBe('测试 <sender@example.com>');
        expect(message.body.text.trim()).toBe(original.text.trim());
        expect(message.body.attachments).toHaveLength(remove ? 0 : 2);
        for (const file of message.body.attachments) {
          const download = await request.get(file.url);
          expect(download.status()).toBe(200);
          expect(await download.body()).toEqual(binary);
          const tampered = new URL(file.url);
          tampered.pathname = tampered.pathname.replace(/.$/, '0');
          expect((await request.get(tampered.href)).status()).toBe(404);
        }
      }
      expect(received.slice(count).map(message => message.path).sort()).toEqual(['/admin', '/user']);
      const id = received[count].body.id;
      const row = await (await request.get(`/api/mail/${id}`, { headers })).json();
      const stored = await (await request.post('/__test/wasm_parse', { data: row.raw })).json();
      const independent = await PostalMime.parse(row.raw);
      expect(stored.sender).toBe(original.sender);
      expect(independent.from?.address).toBe('sender@example.com');
      expect(stored.subject).toBe(original.subject);
      expect(stored.text.trim()).toBe(original.text.trim());
      expect(stored.html.trim()).toBe(original.html.trim());
      expect(stored.attachments).toHaveLength(remove ? 0 : 2);
      for (const [field, value, matched] of [
        ['header.From', 'sender@example.com', true], ['header.From', 'bounce@transport.example', false],
        ['header.To', remove ? mailbox.address : 'first@example.com', true], ['header.Reply-To', 'reply@example.com', !remove],
        ['from', 'sender@example.com', true], ['from', 'not-the-sender@example.com', false],
        ['header.Subject', '测试', true], ['subject', '测试', true],
        ['header.Subject', '错误主题', false],
      ] as const) {
        for (const endpoint of ['/api/webhook/check_filter', '/admin/mail_webhook/check_filter']) {
          const checked = await request.post(endpoint, { headers, data: {
            mail_id: Number(id), filter: { field, operator: 'contains', value },
          } });
          expect(await checked.json(), `${endpoint}: ${field}=${value}, large=${large}, remove=${remove}`).toEqual({ success: true, matched });
        }
      }
    }
  } finally {
    await request.post('/admin/mail_webhook/settings', { data: { enabled: false } });
    await request.delete(`/admin/address/${mailbox.address_id}`);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('sender blacklist still rejects envelope and parsed From addresses before storage', async ({ request, baseURL }) => {
  const mailbox = await createTestAddress(request, 'wasmblocked', undefined, baseURL);
  const headers = { Authorization: `Bearer ${mailbox.jwt}` };
  try {
    for (const [from, header, blocked] of [
      ['sender@blocked-sender.e2e.invalid', 'sender@allowed.example', true],
      ['bounce@allowed.example', 'sender@blocked-sender.e2e.invalid', true],
      ['bounce@allowed.example', 'sender@allowed.example', false],
    ] as const) {
      const raw = makeMail([`From: =?UTF-8?B?5rWL6K+V?=\r\n <${header}>`]);
      const result = await request.post('/__test/receive_mail', { data: { from, to: mailbox.address, raw } });
      expect(result.ok()).toBe(true);
      const delivered = await result.json();
      expect(delivered.success).toBe(!blocked);
      if (blocked) expect(delivered.rejected).toBe('Reject from address');
    }
    const list = await (await request.get('/api/mails?limit=20&offset=0', { headers })).json();
    expect(list.results).toHaveLength(1);
  } finally {
    await request.delete(`/admin/address/${mailbox.address_id}`);
  }
});
