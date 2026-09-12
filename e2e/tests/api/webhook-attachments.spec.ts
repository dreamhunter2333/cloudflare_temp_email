import { test, expect } from '@playwright/test';
import http from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { createTestAddress } from '../../fixtures/test-helpers';

const variants = [
  { name: 'on', url: process.env.WORKER_URL!, removeAll: false, removeLarge: true },
  { name: 'gzip', url: process.env.WORKER_GZIP_URL!, removeAll: false, removeLarge: false },
  { name: 'off', url: process.env.WORKER_URL_ENV_OFF!, removeAll: true, removeLarge: false },
];

test('attachment downloads are forbidden when webhook is disabled', async ({ request }) => {
  const url = process.env.WORKER_URL_SITE_PASSWORD;
  expect(url, 'Worker with webhook disabled must be configured in CI').toBeTruthy();
  const expires = Math.floor(Date.now() / 1000) + 600;
  const response = await request.get(`${url}/open_api/a/1/0/${expires}/${'a'.repeat(52)}`, {
    headers: { 'x-lang': 'en' },
  });
  expect(response.status()).toBe(403);
  expect(await response.text()).toBe('Webhook is not enabled, please contact the administrator');
});

for (const variant of variants) {
  test.describe(`Webhook attachments: ${variant.name}`, () => {
    test('links, expiry, ownership binding, deletion and removal settings', async ({ request }) => {
      test.setTimeout(60_000);
      expect(variant.url, 'Worker variant must be configured in CI').toBeTruthy();
      const { jwt, address, address_id } = await createTestAddress(request, 'attachments', undefined, variant.url);
      const jwtSecret = variant.removeAll ? 'e2e-test-secret-key-env-off' : 'e2e-test-secret-key';
      const headers = { Authorization: `Bearer ${jwt}` };
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
      const hostname = process.env.CI ? 'e2e-runner' : 'localhost';

      try {
        const settings = {
          enabled: true, url: `http://${hostname}:${port}`, method: 'POST',
          headers: '{"Content-Type":"application/json"}',
          body: '{"id":"${id}","ai":${aiExtract},"attachments":${attachments},"text":"${parsedText}","links":"${attachmentLinks}","markdownLinks":"${attachmentMarkdownLinks}"}',
        };
        expect((await request.post(`${variant.url}/api/webhook/settings`, { headers, data: settings })).ok()).toBe(true);

        const receive = async (
          files: { name: string, type: string, content: string }[], large = false,
          messageId: string | null = `<${randomUUID()}@test>`, waitForWebhook = true,
        ) => {
          const boundary = randomUUID();
          const raw = [
            'From: sender@test.example.com', `To: ${address}`, 'Subject: Attachment coverage',
            ...(messageId === null ? [] : [`Message-ID: ${messageId}`]), 'MIME-Version: 1.0',
            `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
            `--${boundary}`, 'Content-Type: text/plain; charset=utf-8', '',
            'Preserved body: "quoted" \\path $& ${from}' + (large ? 'x'.repeat(2 * 1024 * 1024) : ''),
            ...files.flatMap(file => [
              `--${boundary}`, `Content-Type: ${file.type}`,
              `Content-Disposition: attachment; filename="${file.name}"`,
              'Content-Transfer-Encoding: base64', '', Buffer.from(file.content).toString('base64'),
            ]), `--${boundary}--`,
          ].join('\r\n');
          const count = payloads.length;
          const result = await request.post(`${variant.url}/__test/receive_mail`, {
            data: { from: 'sender@test.example.com', to: address, raw },
          });
          expect(result.ok()).toBe(true);
          expect((await result.json()).success).toBe(true);
          if (!waitForWebhook) return;
          await expect.poll(() => payloads.length).toBe(count + 1);
          return payloads[count];
        };

        const files = [
          { name: 'first.png', type: 'image/png', content: 'first bytes' },
          { name: "报告 (copy)'!.txt", type: 'text/plain', content: 'second bytes' },
          { name: 'third.svg', type: 'image/svg+xml', content: '<svg onload="alert(1)"/>' },
        ];
        const payload = await receive(files);
        expect(payload.text).toContain('Preserved body: "quoted" \\path $& ${from}');
        expect(payload.attachments).toHaveLength(variant.removeAll ? 0 : files.length);
        expect(payload.links).toBe(payload.attachments.map((a: any) => a.url).join('\n'));
        const markdownNames = ['first.png', "报告 \\(copy\\)'\\!.txt", 'third.svg'];
        expect(payload.markdownLinks).toBe(payload.attachments.map((a: any, index: number) => `[${markdownNames[index]}](${a.url})`).join('\n'));

        const testMarkdownMessage = async (mailId: number, expectedFiles: typeof files) => {
          for (const endpoint of ['/api/webhook/test', '/admin/mail_webhook/test']) {
            const count = payloads.length;
            const result = await request.post(`${variant.url}${endpoint}`, {
              headers,
              data: {
                ...settings, mail_id: mailId,
                body: JSON.stringify({ msgtype: 'markdown', markdown: {
                  content: '**主题：** ${subject}\n\n${parsedText}\n\n附件：\n${attachmentMarkdownLinks}\n\n下载地址：\n${attachmentLinks}',
                } }),
              },
            });
            expect(result.ok()).toBe(true);
            await expect.poll(() => payloads.length).toBe(count + 1);
            const message = payloads[count];
            expect(Object.keys(message)).toEqual(['msgtype', 'markdown']);
            expect(Object.keys(message.markdown)).toEqual(['content']);
            expect(message.msgtype).toBe('markdown');
            const content = message.markdown.content;
            expect(typeof content).toBe('string');
            expect(content).toContain('**主题：** Attachment coverage\n\n');
            expect(content).toContain('Preserved body: "quoted" \\path $& ${from}');
            const [markdownLinks, plainLinks] = content.split('\n\n附件：\n')[1].split('\n\n下载地址：\n');
            const urls = plainLinks ? plainLinks.split('\n') : [];
            expect(urls).toHaveLength(expectedFiles.length);
            expect(markdownLinks).toBe(urls.map((url: string, index: number) => `[${markdownNames[index]}](${url})`).join('\n'));
            for (const [index, url] of urls.entries()) {
              expect(new URL(url).pathname.split('/')[3]).toBe(String(mailId));
              const response = await request.get(url);
              expect(response.status()).toBe(200);
              expect(await response.text()).toBe(expectedFiles[index].content);
            }
          }
        };
        await testMarkdownMessage(Number(payload.id), variant.removeAll ? [] : files);

        for (const endpoint of ['/api/webhook/test', '/admin/mail_webhook/test']) {
          const count = payloads.length;
          expect((await request.post(`${variant.url}${endpoint}`, { headers, data: settings })).ok()).toBe(true);
          await expect.poll(() => payloads.length).toBe(count + 1);
          const preview = payloads[count];
          expect(preview.ai).toBeNull();
          expect(Array.isArray(preview.attachments)).toBe(true);
          if (endpoint.startsWith('/api/')) {
            expect(preview.attachments).toHaveLength(variant.removeAll ? 0 : files.length);
          }
          for (const attachment of preview.attachments) {
            expect((await request.get(attachment.url)).status()).toBe(200);
          }
        }

        const detail = await request.get(`${variant.url}/api/mail/${payload.id}`, { headers });
        expect(detail.ok()).toBe(true);
        const row = await detail.json();
        const now = Math.floor(Date.now() / 1000);
        const sign = (index: number, expires = now + 600, id = Number(payload.id), recipient = address, created = row.created_at, secret = jwtSecret) => {
          const digest = createHmac('sha256', secret).update(JSON.stringify([
            'webhook-attachment-v1', id, recipient, created, expires, index,
          ])).digest();
          const bits = [...digest].map(byte => byte.toString(2).padStart(8, '0')).join('');
          const signature = bits.match(/.{1,5}/g)!.map(group =>
            'abcdefghijklmnopqrstuvwxyz234567'[parseInt(group.padEnd(5, '0'), 2)]
          ).join('');
          return `/open_api/a/${id}/${index}/${expires}/${signature}`;
        };
        const get = (path: string) => request.get(new URL(path, variant.url).href);

        for (const [index, attachment] of payload.attachments.entries()) {
          expect(attachment.filename).toBe(files[index].name);
          expect(attachment.mimeType).toBe(files[index].type);
          expect(new URL(attachment.url).origin).toBe(new URL(variant.url).origin);
          const signedUrl = new URL(attachment.url);
          const signature = signedUrl.pathname.split('/').at(-1)!;
          expect(signature).toMatch(/^[a-z2-7]{51}[aq]$/);
          signedUrl.pathname = signedUrl.pathname.replace(signature, signature.toUpperCase());
          expect((await get(signedUrl.href)).status()).toBe(200);
          signedUrl.pathname = signedUrl.pathname.replace(signature.toUpperCase(),
            [...signature].map((character, index) => index % 2 ? character.toUpperCase() : character).join(''));
          expect((await get(signedUrl.href)).status()).toBe(200);
          const response = await get(attachment.url);
          expect(response.status()).toBe(200);
          expect(await response.text()).toBe(files[index].content);
          expect(response.headers()['cache-control']).toBe('no-store');
          expect(response.headers()['x-content-type-options']).toBe('nosniff');
          const filename = encodeURIComponent(files[index].name).replace(/[!'()*]/g,
            character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
          expect(response.headers()['content-disposition']).toBe(index === 0 ? 'inline' : `attachment; filename*=UTF-8''${filename}`);
          expect(response.headers()['content-type']).toBe(index === 0 ? 'image/png' : 'application/octet-stream');
        }

        expect((await get(sign(0))).status()).toBe(variant.removeAll ? 404 : 200);
        for (const path of [
          sign(0, now - 1), sign(0, now + 86460), sign(-1), sign(999),
          sign(0, now + 600, Number(payload.id), 'other@test.example.com'),
          sign(0, now + 600, Number(payload.id), address, '2000-01-01 00:00:00'),
          sign(0, now + 600, Number(payload.id), address, row.created_at, 'wrong-secret'),
          sign(0, now + 600, Number.MAX_SAFE_INTEGER),
          `/open_api/a/${payload.id}/invalid/${now + 600}/${'A'.repeat(52)}`,
          `/open_api/a/${payload.id}/0/${now + 600}/${'0'.repeat(52)}`,
          `/open_api/a/${payload.id}/0/${now + 600}/${'a'.repeat(51)}b`,
          `/open_api/a/${payload.id}/0/${now + 600}/short`,
        ]) {
          expect((await get(path)).status(), path).toBe(404);
        }

        const empty = await receive([]);
        expect(empty.attachments).toEqual([]);
        expect(empty.links).toBe('');
        expect(empty.markdownLinks).toBe('');
        await testMarkdownMessage(Number(empty.id), []);
        const emptyRow = await (await request.get(`${variant.url}/api/mail/${empty.id}`, { headers })).json();
        expect((await get(sign(0, now + 600, Number(empty.id), address, emptyRow.created_at))).status()).toBe(404);
        const deleted = await request.delete(`${variant.url}/admin/mails/${payload.id}`);
        expect(deleted.ok()).toBe(true);
        expect((await get(sign(0))).status()).toBe(404);

        if (variant.removeLarge) {
          const large = await receive(files, true);
          expect(large.attachments).toEqual([]);
          expect(large.text).toContain('Preserved body');
          const largeRow = await (await request.get(`${variant.url}/api/mail/${large.id}`, { headers })).json();
          expect((await get(sign(0, now + 600, Number(large.id), address, largeRow.created_at))).status()).toBe(404);
        }

        if (!variant.removeAll) {
          for (const messageId of [`<${randomUUID()}@duplicate.test>`, null]) {
            const count = payloads.length;
            const names = Array.from({ length: 4 }, () => `${randomUUID()}.txt`);
            await Promise.all(names.map(name => receive([
              { name, type: 'text/plain', content: name },
            ], false, messageId, false)));
            await expect.poll(() => payloads.length).toBe(count + names.length);
            const received = payloads.slice(count);
            expect(new Set(received.map(mail => mail.id)).size).toBe(names.length);
            expect(received.map(mail => mail.attachments[0].filename).sort()).toEqual([...names].sort());
            for (const mail of received) {
              expect(mail.attachments).toHaveLength(1);
              const attachment = mail.attachments[0];
              const response = await request.get(attachment.url);
              expect(response.status()).toBe(200);
              expect(await response.text()).toBe(attachment.filename);
              expect(new URL(attachment.url).pathname.split('/')[3]).toBe(String(mail.id));
            }
          }
        }
      } finally {
        await request.delete(`${variant.url}/admin/delete_address/${address_id}`);
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    });
  });
}
