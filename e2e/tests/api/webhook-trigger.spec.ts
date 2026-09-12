import { test, expect } from '@playwright/test';
import http from 'node:http';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
} from '../../fixtures/test-helpers';

/**
 * Start a temporary HTTP server that records incoming requests.
 * Returns the server, a promise that resolves with the first request body,
 * and the URL to use as webhook target.
 */
async function startWebhookReceiver(): Promise<{
  server: http.Server;
  firstRequest: Promise<{ body: string; method: string; path: string; headers: http.IncomingHttpHeaders }>;
  url: string;
}> {
  let resolve: (val: any) => void;
  const firstRequest = new Promise<any>((r) => { resolve = r; });

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      resolve({
        body: Buffer.concat(chunks).toString('utf-8'),
        method: req.method || '',
        path: req.url || '',
        headers: req.headers,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });

  // Use port 0 to let the OS assign a free port
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to resolve webhook receiver port');
  const boundPort = addr.port;
  // In Docker network, e2e-runner container hostname is "e2e-runner"
  const hostname = process.env.CI ? 'e2e-runner' : 'localhost';
  return { server, firstRequest, url: `http://${hostname}:${boundPort}/webhook` };
}

test.describe('Webhook — triggered on incoming mail', () => {
  let jwt: string;
  let address: string;

  test.beforeAll(async ({ request }) => {
    ({ jwt, address } = await createTestAddress(request, 'webhook-trigger'));
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('webhook is called with correct payload when mail arrives', async ({ request }) => {
    const { server, firstRequest, url } = await startWebhookReceiver();

    try {
      // Configure user webhook
      const saveRes = await request.post(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: true,
          url,
          method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            from: '${from}',
            to: '${to}',
            subject: '${subject}',
            aiExtractType: '${aiExtractType}',
            aiExtractResult: '${aiExtractResult}',
            aiExtractResultText: '${aiExtractResultText}',
          }),
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Send incoming mail via receive_mail endpoint
      const from = `webhook-sender@test.example.com`;
      const subject = `Webhook Test ${Date.now()}`;
      const messageId = `<webhook-${Date.now()}@test>`;
      const raw = [
        `From: ${from}`,
        `To: ${address}`,
        `Subject: ${subject}`,
        `Message-ID: ${messageId}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `Webhook trigger test body`,
      ].join('\r\n');

      const res = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: {
          from,
          to: address,
          raw,
          ai_extract_result: {
            type: 'auth_code',
            result: '654321',
            result_text: 'Login verification code',
          },
        },
      });
      expect(res.ok()).toBe(true);

      // Wait for webhook to be called
      const received = await firstRequest;
      expect(received.method).toBe('POST');
      expect(received.path).toBe('/webhook');

      const payload = JSON.parse(received.body);
      expect(payload.from).toContain('webhook-sender@test.example.com');
      expect(payload.to).toBe(address);
      expect(payload.subject).toBe(subject);
      expect(payload.aiExtractType).toBe('auth_code');
      expect(payload.aiExtractResult).toBe('654321');
      expect(payload.aiExtractResultText).toBe('Login verification code');
    } finally {
      server.close();
    }
  });

  test('signed attachment paths serve each attachment and reject tampering', async ({ request }) => {
    const { server, firstRequest, url } = await startWebhookReceiver();

    try {
      const saveRes = await request.post(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: true,
          url,
          method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: '{"attachments":${attachments}}',
        },
      });
      expect(saveRes.ok()).toBe(true);

      const attachment = Buffer.from('89504e470d0a1a0a', 'hex');
      const boundary = `webhook-attachment-${Date.now()}`;
      const raw = [
        `From: attachment-sender@test.example.com`,
        `To: ${address}`,
        `Subject: Webhook Attachment ${Date.now()}`,
        `Message-ID: <webhook-attachment-${Date.now()}@test>`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `Attachment test`,
        `--${boundary}`,
        `Content-Type: image/png`,
        `Content-Disposition: attachment; filename="test.png"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        attachment.toString('base64'),
        `--${boundary}`,
        `Content-Type: text/plain`,
        `Content-Disposition: attachment; filename="second.txt"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        Buffer.from('Second attachment').toString('base64'),
        `--${boundary}--`,
      ].join('\r\n');

      const res = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: {
          from: 'attachment-sender@test.example.com',
          to: address,
          raw,
        },
      });
      expect(res.ok()).toBe(true);

      const payload = JSON.parse((await firstRequest).body);
      expect(payload.attachments).toHaveLength(2);
      expect(payload.attachments[0]).toMatchObject({ filename: 'test.png', mimeType: 'image/png' });
      expect(new URL(payload.attachments[0].url).origin).toBe(new URL(WORKER_URL).origin);
      const attachmentPath = new URL(payload.attachments[0].url).pathname;
      expect(attachmentPath).toMatch(/^\/open_api\/a\/\d+\/0\/\d+\/[a-z2-7]{51}[aq]$/);
      expect(payload.attachments[1].filename).toBe('second.txt');

      const attachmentRes = await request.get(payload.attachments[0].url);
      expect(attachmentRes.ok()).toBe(true);
      expect(attachmentRes.headers()['content-type']).toBe('image/png');
      expect(attachmentRes.headers()['content-disposition']).toBe('inline');
      expect(attachmentRes.headers()['x-content-type-options']).toBe('nosniff');
      expect(attachmentRes.headers()['cache-control']).toBe('no-store');
      expect(Buffer.from(await attachmentRes.body())).toEqual(attachment);

      const secondRes = await request.get(payload.attachments[1].url);
      expect(secondRes.status()).toBe(200);
      expect(secondRes.headers()['content-disposition']).toBe("attachment; filename*=UTF-8''second.txt");
      expect(secondRes.headers()['content-type']).toBe('application/octet-stream');
      expect(await secondRes.text()).toBe('Second attachment');

      const parts = attachmentPath.split('/');
      parts[parts.length - 1] = (parts.at(-1)[0] === 'a' ? 'b' : 'a') + parts.at(-1).slice(1);
      const tamperedPath = parts.join('/');
      const tamperedRes = await request.get(`${WORKER_URL}${tamperedPath}`);
      expect(tamperedRes.status()).toBe(404);
      for (const index of ['1', '999', '-1']) {
        const changedIndex = attachmentPath.replace('/0/', `/${index}/`);
        expect((await request.get(`${WORKER_URL}${changedIndex}`)).status()).toBe(404);
      }
    } finally {
      server.close();
    }
  });

  test('webhook is NOT called when disabled', async ({ request }) => {
    const { server, firstRequest, url } = await startWebhookReceiver();

    try {
      // Disable webhook
      const saveRes = await request.post(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: false,
          url,
          method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ from: '${from}' }),
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Send incoming mail
      const subject = `Webhook Disabled ${Date.now()}`;
      const messageId = `<webhook-off-${Date.now()}@test>`;
      const raw = [
        `From: sender@test.example.com`,
        `To: ${address}`,
        `Subject: ${subject}`,
        `Message-ID: ${messageId}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `Should not trigger webhook`,
      ].join('\r\n');

      const res = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: { from: 'sender@test.example.com', to: address, raw },
      });
      expect(res.ok()).toBe(true);

      // Webhook should NOT be called — wait briefly then verify timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3_000)
      );
      await expect(
        Promise.race([firstRequest, timeoutPromise])
      ).rejects.toThrow('timeout');
    } finally {
      server.close();
    }
  });
});
