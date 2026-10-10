import { test, expect } from '@playwright/test';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import PostalMime from 'postal-mime';
import { isValidFilterExpression } from '../../../frontend/src/utils/filter';
import { compileWebhookFilter, filterWebhooks } from '../../../worker/src/common';
import type { AddressInfo } from 'node:net';
import { WORKER_URL, createTestAddress } from '../../fixtures/test-helpers';

const all = (...conditions: any[]): any => {
  if (conditions.length === 1) return conditions[0];
  const middle = Math.floor(conditions.length / 2);
  return { operator: 'and', children: [all(...conditions.slice(0, middle)), all(...conditions.slice(middle))] };
};

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
  const filter = all(
      { field: 'from', operator: 'equals', value: 'Sender, Display <first@example.com>' },
      { operator: 'or', children: [
        { field: 'subject', operator: 'regex', value: '^down\\b', options: { flags: 'i' } },
        { field: 'subject', operator: 'contains', value: '告警' },
      ] },
      { operator: 'not', children: [{ field: 'text', operator: 'contains', value: 'maintenance' }] },
      { field: 'to', operator: 'equals', value: mailbox.address },
      { field: 'header.X-Category', operator: 'equals', value: 'critical' },
  );
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
    expect(received[0].body.from).toBe('Sender, Display <first@example.com>');
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
      const checkEndpoint = endpoint.replace('/test', '/check_filter');
      const check = await request.post(`${WORKER_URL}${checkEndpoint}`, { headers, data: { filter, mail_id } });
      expect(check.ok(), await check.text()).toBe(true);
      expect(await check.json()).toEqual({ success: true, matched: true });
      expect((await request.post(`${WORKER_URL}${checkEndpoint}`, { headers, data: { filter } })).ok()).toBe(true);
      expect(await (await request.post(`${WORKER_URL}${checkEndpoint}`, { headers, data: { mail_id } })).json()).toEqual({ success: true, matched: true });
      expect(received).toHaveLength(before);
      const mismatchedFilter = { field: 'subject', operator: 'equals', value: 'never' };
      const mismatch = await request.post(`${WORKER_URL}${checkEndpoint}`, { headers, data: {
        mail_id, filter: mismatchedFilter,
      } });
      expect(await mismatch.json()).toEqual({ success: true, matched: false });
      expect(received).toHaveLength(before);
      for (const rule of [filter, mismatchedFilter, { operator: 'invalid' }]) {
        const sent = await request.post(`${WORKER_URL}${endpoint}`, { headers, data: { ...settings, filter: rule, mail_id } });
        expect(await sent.json()).toEqual({ success: true });
      }
      expect(received).toHaveLength(before + 3);
      expect(received.at(-1)!.body.to).toBe(endpoint.startsWith('/admin/') ? 'admin@test.com' : mailbox.address);
      expect(received.at(-1)!.body.from).toBe('Sender, Display <first@example.com>');
      // The stored envelope sender must not match the parsed From field.
      const envelope = await request.post(`${WORKER_URL}${checkEndpoint}`, { headers, data: {
        mail_id,
        filter: { field: 'from', operator: 'contains', value: 'bounce@transport.example.com' },
      } });
      expect(await envelope.json()).toEqual({ success: true, matched: false });
      for (const value of ['(?=故障)故障', '(?=(故障))\\1', '(?<label>故障)告警']) {
        const nativeRegex = await request.post(`${WORKER_URL}${checkEndpoint}`, { headers, data: {
          mail_id, filter: { field: 'subject', operator: 'regex', value },
        } });
        expect(await nativeRegex.json()).toEqual({ success: true, matched: true });
      }
      expect(received).toHaveLength(before + 3);
    }
    const fallback = await request.post(`${WORKER_URL}/api/webhook/test`, {
      headers: { Authorization: `Bearer ${other.jwt}` }, data: { ...settings, filter: { operator: 'invalid' } },
    });
    expect(await fallback.json()).toEqual({ success: true });
    expect(received.at(-1)!.body.from).toBe('test@test.com');
    expect(received.at(-1)!.body.to).toBe(other.address);
    const before = received.length;
    for (const data of [{ filter, mail_id }, { filter }, {}]) {
      expect((await request.post(`${WORKER_URL}/api/webhook/check_filter`, {
        headers: { Authorization: `Bearer ${other.jwt}` }, data,
      })).status()).toBe(404);
    }
    for (const endpoint of ['/api/webhook/check_filter', '/admin/mail_webhook/check_filter']) {
      expect((await request.post(`${WORKER_URL}${endpoint}`, { headers, data: { filter, mail_id: 2147483647 } })).status()).toBe(404);
    }
    expect((await request.post(`${WORKER_URL}/api/webhook/test`, {
      headers: { Authorization: `Bearer ${other.jwt}` }, data: { ...settings, filter, mail_id },
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
  const leaf = { field: 'subject', operator: 'contains', value: 'DOWN' };
  const invalid = [
    {}, false, [], { operator: 'and', children: [] },
    ...['and', 'or'].flatMap(operator => [
      { operator, children: [leaf] }, { operator, children: [leaf, leaf, leaf] },
      { operator, children: [leaf, null] },
    ]),
    { operator: 'not', children: [leaf, leaf] }, { operator: 'not', children: [null] },
    { field: 'unknown', operator: 'equals', value: '' },
    { field: 'envelopeFrom', operator: 'equals', value: '' },
    { field: 'headerFrom', operator: 'equals', value: '' },
    { field: 'subject', operator: 'unknown', value: '' },
    { field: 'subject', operator: 'regex', value: '[' },
    { field: 'subject', operator: 'regex', value: '(' },
    { field: 'subject', operator: 'regex', value: '*a' },
    { field: 'subject', operator: 'regex', value: 'x', options: { flags: 'g' } },
    { field: 'subject', operator: 'regex', value: 'x', options: { flags: 'ii' } },
    { field: 'subject', operator: 'regex', value: 'x', options: { flags: false } },
    { operator: 'not', children: [] },
    { operator: 'or', children: [{ field: 'subject', operator: 'contains', value: '' }, { operator: 'broken' }] },
  ];
  try {
    expect((await request.post(`${WORKER_URL}/api/webhook/check_filter`, { data: {} })).status()).toBe(401);
    expect((await request.post(`${WORKER_URL}/api/webhook/check_filter`, {
      headers: { Authorization: 'Bearer invalid' }, data: {},
    })).status()).toBe(401);
    for (const base of ['/api/webhook', '/admin/mail_webhook']) {
      expect((await request.post(`${WORKER_URL}${base}/settings`, { headers, data: original })).ok()).toBe(true);
      for (const filter of invalid) {
        for (const action of ['settings', 'check_filter']) {
          const response = await request.post(`${WORKER_URL}${base}/${action}`, { headers, data: { ...original, filter } });
          expect(response.status()).toBe(400);
          expect(await response.text()).toContain('Invalid filter');
        }
      }
      expect(await (await request.get(`${WORKER_URL}${base}/settings`, { headers })).json()).toEqual(original);
      const zh = await request.post(`${WORKER_URL}${base}/check_filter`, {
        headers: { ...headers, 'x-lang': 'zh' }, data: { ...original, filter: {} },
      });
      expect(await zh.text()).toContain('无效的过滤规则');
      for (const data of [null, [], { mail_id: 0 }, { mail_id: 1.5 }, { mail_id: '1' }]) {
        expect((await request.post(`${WORKER_URL}${base}/check_filter`, { headers, data })).status()).toBe(400);
      }
      for (const action of ['settings', 'check_filter', 'test']) {
        for (const body of ['', '{', '[', 'invalid']) {
          const response = await request.post(`${WORKER_URL}${base}/${action}`, {
            headers: { ...headers, 'Content-Type': 'application/json' }, data: Buffer.from(body),
          });
          expect(response.status(), `${base}/${action}: ${body}`).toBe(500);
          expect((await response.json()).message).toContain('SyntaxError');
        }
        for (const body of ['null', '[]', 'false', '1', '"text"']) {
          const response = await request.post(`${WORKER_URL}${base}/${action}`, {
            headers: { ...headers, 'Content-Type': 'application/json' }, data: body,
          });
          expect(response.status(), `${base}/${action}: ${body}`).toBe(400);
          expect(await response.text()).toContain('Invalid request body');
        }
      }
      expect(await (await request.get(`${WORKER_URL}${base}/settings`, { headers })).json()).toEqual(original);
    }
  } finally {
    await request.post(`${WORKER_URL}/admin/mail_webhook/settings`, { data: adminSettings });
    await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
  }
});

for (const variant of [
  { name: 'remove all attachments', url: process.env.WORKER_URL_ENV_OFF!, large: false },
  { name: 'remove large attachments', url: WORKER_URL, large: true },
]) {
  test(`Webhook filter and stored-mail checks preserve parsed From: ${variant.name}`, async ({ request }) => {
    test.setTimeout(90_000);
    expect(variant.url, 'Attachment removal worker must be configured').toBeTruthy();
    const mailbox = await createTestAddress(request, 'filterremove', undefined, variant.url);
    const headers = { Authorization: `Bearer ${mailbox.jwt}` };
    const adminEndpoint = `${variant.url}/admin/mail_webhook/settings`;
    const previousAdmin = await (await request.get(adminEndpoint)).json();
    const received: { path: string; body: any }[] = [];
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          received.push({ path: req.url!, body: JSON.parse(Buffer.concat(chunks).toString()) });
          res.writeHead(200).end();
        } catch {
          res.writeHead(400).end();
        }
      });
    });
    await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve));
    const url = `http://${process.env.CI ? 'e2e-runner' : 'localhost'}:${(server.address() as AddressInfo).port}`;
    const settings = {
      enabled: true, method: 'POST', headers: '{"Content-Type":"application/json"}',
      body: '{"id":"${id}","from":"${from}","to":"${to}","subject":"${subject}","text":"${parsedText}","html":"${parsedHtml}","attachments":${attachments}}',
    };
    const save = async (filter: any) => {
      for (const [endpoint, path] of [[adminEndpoint, '/admin'], [`${variant.url}/api/webhook/settings`, '/user']]) {
        const response = await request.post(endpoint, { headers, data: { ...settings, url: url + path, filter } });
        expect(response.ok(), await response.text()).toBe(true);
      }
    };
    try {
      for (const sample of [
        { kind: 'plain', from: ['From: "Sender, Display" <first@example.com>, second@example.com'] },
        { kind: 'html', from: ['From: "Name \\"Quoted\\"" <first@example.com>'] },
        { kind: 'both', from: [`From: =?UTF-8?B?${Buffer.from('发件人').toString('base64')}?= <first@example.com>, second@example.com`] },
        { kind: 'plain', from: ['From: "Name <fake@example.net>" <first@example.com>'] },
        { kind: 'plain', from: ['From: "Cost $& $1 $$ \\\\ Name" <first@example.com>'] },
        { kind: 'plain', from: ['From: first@example.com'] },
        { kind: 'plain', from: ['fRoM: Mixed Case <first@example.com>'] },
        { kind: 'plain', from: ['From: "Folded, Name"', ' <first@example.com>, second@example.com'] },
        { kind: 'plain', from: ['From: Other <other@example.org>', 'From: Last <first@example.com>'] },
        { kind: 'plain', from: ['From: invalid', 'From: Last <first@example.com>'] },
        { kind: 'plain', from: ['From: First <first@example.com>', 'From: invalid'] },
        { kind: 'plain', from: ['From: First <first@example.com>', 'From:'] },
        { kind: 'plain', from: [] },
        { kind: 'plain', from: ['From: invalid'] },
        { kind: 'plain', from: ['From: Team: first@example.com;'] },
      ]) {
        const { kind } = sample;
        const boundary = randomUUID();
        const text = kind === 'plain' || kind === 'both' ? '正文\n"quoted" \\path $& ${from}'.repeat(40) : '';
        const html = kind === 'html' || kind === 'both' ? '<p>正文 &amp; "quoted"</p>'.repeat(40) : '';
        const raw = [
          ...sample.from,
          'Sender: unrelated@example.net',
          kind === 'both' ? 'To: Team: advertised@example.org, another@example.org;'
            : 'To: advertised@example.org, another@example.org',
          'Cc: cc1@example.org, cc2@example.org', 'Reply-To: reply1@example.org, reply2@example.org',
          'Subject: From filter test',
          `Message-ID: <${randomUUID()}@test>`,
          'X-Tag: a', 'x-tag: b', 'Content-Length: 1', 'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
          ...(text || !html ? [`--${boundary}`, 'Content-Type: text/plain; charset=utf-8',
            'Content-Transfer-Encoding: base64', '', Buffer.from(text).toString('base64')] : []),
          ...(html ? [`--${boundary}`, 'Content-Type: text/html; charset=utf-8',
            'Content-Transfer-Encoding: base64', '', Buffer.from(html).toString('base64')] : []),
          `--${boundary}`, 'Content-Type: application/octet-stream',
          'Content-Disposition: attachment; filename="removed.bin"', 'Content-Transfer-Encoding: base64', '',
          Buffer.alloc(variant.large ? 2 * 1024 * 1024 : 8, 65).toString('base64'), `--${boundary}--`,
        ].join('\r\n');
        const original = await PostalMime.parse(raw);
        const fromHeaders = original.headers.filter(header => header.key === 'from').map(header => header.value);
        const sender = original.from ? `${original.from.name} <${original.from.address}>` : '';
        const filter = all(
          { field: 'from', operator: 'equals', value: sender },
          { field: 'to', operator: 'equals', value: mailbox.address },
          { field: 'subject', operator: 'equals', value: original.subject || '' },
          { field: 'text', operator: original.text ? 'contains' : 'equals', value: (original.text || '').slice(0, 100) },
          { field: 'html', operator: original.html ? 'contains' : 'equals', value: (original.html || '').slice(0, 100) },
          ...(fromHeaders.length
            ? fromHeaders.map(value => ({ field: 'header.From', operator: 'equals', value }))
            : [{ operator: 'not', children: [{ field: 'header.From', operator: 'contains', value: '' }] }]),
        );
        await save(filter);
        const count = received.length;
        const deliver = async () => {
          const response = await request.post(`${variant.url}/__test/receive_mail`, {
            data: { from: 'bounce@transport.example.net', to: mailbox.address, raw },
          });
          expect(response.ok(), await response.text()).toBe(true);
          expect((await response.json()).success).toBe(true);
        };
        await deliver();
        expect(received).toHaveLength(count + 2);
        expect(received.slice(count).map(message => message.path)).toEqual(['/admin', '/user']);
        for (const message of received.slice(count)) {
          expect(message.body).toMatchObject({
            from: sender, to: mailbox.address, subject: original.subject || '',
            text: original.text || '', html: original.html || '',
          });
          expect(message.body.attachments).toHaveLength(0);
        }
        const mail_id = Number(received.at(-1)!.body.id);
        const stored = await (await request.get(`${variant.url}/api/mail/${mail_id}`, { headers })).json();
        const parsed = await PostalMime.parse(stored.raw);
        expect(parsed.from).toEqual(original.from);
        expect(parsed.headers.filter(header => header.key === 'from').map(header => header.value))
          .toEqual(fromHeaders);
        expect(parsed.attachments).toHaveLength(0);
        for (const endpoint of ['/api/webhook/check_filter', '/admin/mail_webhook/check_filter']) {
          const result = await request.post(variant.url + endpoint, { headers, data: { filter, mail_id } });
          expect(await result.json()).toEqual({ success: true, matched: true });
        }
        expect(received).toHaveLength(count + 2);
        const mismatch = { field: 'from', operator: 'contains', value: 'bounce@transport.example.net' };
        await save(mismatch);
        await deliver();
        expect(received).toHaveLength(count + 2);
        for (const endpoint of ['/api/webhook/check_filter', '/admin/mail_webhook/check_filter']) {
          const result = await request.post(variant.url + endpoint, { headers, data: { filter: mismatch, mail_id } });
          expect(await result.json()).toEqual({ success: true, matched: false });
        }
      }
    } finally {
      await request.post(adminEndpoint, { data: previousAdmin });
      await request.delete(`${variant.url}/admin/delete_address/${mailbox.address_id}`);
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
}

test.describe('Webhook filter contract', () => {
  const operators = [
    ...['equals', 'contains', 'startsWith', 'endsWith'].flatMap(value => [
      { value, label: value }, { value: `${value}CaseSensitive`, label: value },
    ]),
    { value: 'regex', label: 'regex', options: [{ key: 'flags', label: 'flags' }] },
  ];
  const isFieldAllowed = (field: string) => ['from', 'to', 'subject', 'text', 'html'].includes(field)
    || /^header\.[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/.test(field);
  const leaf = { field: 'subject', operator: 'contains', value: 'DOWN' };

  test('generic editor validation and backend accept the consumer filter contract', () => {
    let deep: any = leaf;
    for (let i = 0; i < 8; i++) deep = { operator: 'not', children: [deep] };
    const cases = [null, undefined, false, {}, [], leaf, deep,
      { operator: 'and', children: [] }, { operator: 'not', children: [leaf, leaf] },
      { operator: 'and', children: [leaf] }, { operator: 'or', children: [leaf] },
      { operator: 'and', children: [leaf, leaf, leaf] }, { operator: 'or', children: [leaf, leaf, leaf] },
      { operator: 'and', children: [leaf, null] }, { operator: 'not', children: [null] },
      all(...Array(64).fill(leaf)),
      { operator: 'or', children: Array(99).fill(leaf) }, { operator: 'or', children: Array(100).fill(leaf) },
      { ...leaf, value: 'x'.repeat(501) }, { ...leaf, options: [] },
      ...['from', 'text', 'html', 'header.List-ID', 'header.X-Tag', 'headerFrom', 'envelopeFrom', '', 'header.', 'header.Bad Header']
        .map(field => ({ ...leaf, field })),
      ...operators.map(operator => ({ ...leaf, operator: operator.value })),
      ...['unknown', 'constructor', 'toString'].map(operator => ({ ...leaf, operator })),
      ...['', 'ims'].map(flags => (
        { field: 'subject', operator: 'regex', value: '^DOWN', options: { flags } }
      )),
      { ...leaf, options: { flags: 'i' } }, { ...leaf, options: { caseSensitive: true } },
      { ...leaf, operator: 'regex', options: { unknown: true } },
    ];
    for (const rule of cases) {
      let backendValid = true;
      try { compileWebhookFilter(rule); } catch { backendValid = false; }
      expect(isValidFilterExpression(rule, operators, isFieldAllowed), JSON.stringify(rule)).toBe(backendValid);
    }
  });

  test('regex syntax and flags are validated only by the backend', () => {
    for (const invalid of [
      { field: 'subject', operator: 'regex', value: '[' },
      { field: 'subject', operator: 'regex', value: '(' },
      { field: 'subject', operator: 'regex', value: '*a' },
      ...['g', 'ii', false].map(flags => ({ field: 'subject', operator: 'regex', value: '^DOWN', options: { flags } })),
    ]) {
      const rule = { operator: 'or', children: [leaf, invalid] };
      expect(isValidFilterExpression(rule, operators, isFieldAllowed)).toBe(true);
      expect(() => compileWebhookFilter(rule)).toThrow();
    }
  });
});

test.describe('Webhook filter field mapping', () => {
  const mail = { sender: 'Blocked, Display <first@example.com>', subject: 'DOWN', text: '', html: '<p>HTML only</p>', headers: [
    { key: 'From', value: '"Blocked, Display" <first@example.com>, second@example.com' },
    { key: 'from', value: 'third@example.com' },
    { key: 'X-Tag', value: 'a' }, { key: 'x-tag', value: 'b' },
    { key: 'Reply-To', value: 'reply@example.com' },
  ] };
  const match = (field: string, value: string) => compileWebhookFilter({ field, operator: 'equals', value })(mail, 'real@example.org');
  test('filtering isolates invalid rules and preserves unfiltered webhooks on parse failure', () => {
    const legacy: any = { enabled: true };
    const matching: any = { filter: { field: 'subject', operator: 'equals', value: 'DOWN' } };
    const invalid: any = { filter: { field: 'unknown', operator: 'equals', value: 'DOWN' } };
    const unmatched: any = { filter: { field: 'subject', operator: 'equals', value: 'UP' } };
    const settings = [legacy, matching, invalid, unmatched];
    const log = console.error;
    const errors: unknown[][] = [];
    console.error = (...args) => { errors.push(args); };
    try {
      expect(filterWebhooks(settings, mail, 'real@example.org')).toEqual([legacy, matching]);
      expect(errors).toHaveLength(1);
      expect(filterWebhooks(settings, undefined, 'real@example.org')).toEqual([legacy]);
      expect(errors).toHaveLength(4);
      expect(settings).toEqual([legacy, matching, invalid, unmatched]);
    } finally {
      console.error = log;
    }
  });
  test('from uses only the parsed sender, including the display name', () => {
    expect(match('from', mail.sender)).toBe(true);
    for (const value of ['second@example.com', 'third@example.com', 'bounce@example.net']) expect(match('from', value)).toBe(false);
    for (const value of ['Blocked, Display', 'first@example.com']) {
      expect(compileWebhookFilter({ field: 'from', operator: 'contains', value })(mail, '')).toBe(true);
    }
    expect(match('from', 'reply@example.com')).toBe(false);
    for (const field of ['headerFrom', 'envelopeFrom']) {
      expect(() => compileWebhookFilter({ field, operator: 'equals', value: '' })).toThrow();
    }
    expect(compileWebhookFilter({ field: 'from', operator: 'equals', value: '' })({ ...mail, sender: '' }, '')).toBe(true);
    expect(match('to', 'real@example.org')).toBe(true);
  });
  test('documented From domain rule matches parsed sender rather than the display name', () => {
    const match = compileWebhookFilter({ field: 'from', operator: 'regex', value: '@example\\.com>$', options: { flags: 'i' } });
    for (const sender of [mail.sender, 'Sender <USER@EXAMPLE.COM>']) {
      expect(match({ ...mail, sender }, '')).toBe(true);
    }
    for (const sender of ['Sender <user@example.com.evil>', 'Sender <user@notexample.com>',
      'Sender <user@exampleXcom>', 'user@example.com <user@other.com>', '']) {
      expect(match({ ...mail, sender }, '')).toBe(false);
    }
  });
  test('repeated case-insensitive header names; missing and HTML-only text', () => {
    expect(match('header.X-TAG', 'b')).toBe(true);
    expect(match('header.missing', '')).toBe(false);
    expect(match('text', '')).toBe(true);
    expect(match('html', '<p>HTML only</p>')).toBe(true);
  });
  test('missing parsed data throws even under NOT, while legacy settings still pass', () => {
    expect(() => compileWebhookFilter({ operator: 'not', children: [{ field: 'subject', operator: 'equals', value: '' }] })(undefined, '')).toThrow();
    const unreadable = { ...mail, get sender(): never { throw new Error('Unfiltered mail should not be read'); } };
    for (const filter of [undefined, null]) {
      const match = compileWebhookFilter(filter);
      expect(match(undefined, '')).toBe(true);
      expect(match(unreadable, '')).toBe(true);
    }
  });
  test('multiple conditions on the same header retain distinct matching values', () => {
    const match = compileWebhookFilter(all(
      { field: 'header.X-Tag', operator: 'equals', value: 'a' },
      { field: 'header.X-Tag', operator: 'equals', value: 'b' },
      { field: 'header.x-tag', operator: 'regex', value: '^b$' },
    ));
    expect(match(mail, '')).toBe(true);
    expect(match({ ...mail, headers: [{ key: 'X-Tag', value: 'a' }] }, '')).toBe(false);
    expect(match({ ...mail, headers: [] }, '')).toBe(false);
    expect(match(mail, '')).toBe(true);
  });
  test('compiled matcher can be reused without leaking previous mail headers', () => {
    const match = compileWebhookFilter({ field: 'header.X-Tag', operator: 'equals', value: 'b' });
    expect(match(mail, '')).toBe(true);
    expect(match({ ...mail, headers: [] }, '')).toBe(false);
    expect(match(mail, '')).toBe(true);
  });
  test('many repeated headers retain all values without mutating parsed mail', () => {
    const headers = Array.from({ length: 20000 }, (_, index) => Object.freeze({ key: index % 2 ? 'X-Tag' : 'x-tag', value: String(index) }));
    const repeated = { ...mail, headers };
    for (const value of ['0', '10000', '19999']) {
      expect(compileWebhookFilter({ field: 'header.X-Tag', operator: 'equals', value })(repeated, '')).toBe(true);
    }
    expect(headers).toHaveLength(20000);
    expect(headers[0].value).toBe('0');
    expect(headers.at(-1)!.value).toBe('19999');
  });
  test('filters without header conditions do not read headers', () => {
    const noHeaders = { ...mail, get headers(): never { throw new Error('Headers should not be read'); } };
    expect(compileWebhookFilter({ field: 'subject', operator: 'equals', value: 'DOWN' })(noHeaders, '')).toBe(true);
  });
  test('header filters do not aggregate unrelated header values', () => {
    let reads = 0;
    const unrelated = Array.from({ length: 20000 }, () => ({ key: 'X-Unrelated', get value() { reads++; return 'unused'; } }));
    const match = compileWebhookFilter({ field: 'header.X-Tag', operator: 'equals', value: 'b' });
    expect(match({ ...mail, headers: [...unrelated, ...mail.headers] }, '')).toBe(true);
    expect(match({ ...mail, headers: unrelated }, '')).toBe(false);
    expect(reads).toBe(0);
  });
});
