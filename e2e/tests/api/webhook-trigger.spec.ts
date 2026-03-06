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
async function startWebhookReceiver(port: number): Promise<{
  server: http.Server;
  firstRequest: Promise<{ body: string; method: string; headers: http.IncomingHttpHeaders }>;
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
        headers: req.headers,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });

  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
  // In Docker network, e2e-runner container hostname is "e2e-runner"
  const hostname = process.env.CI ? 'e2e-runner' : 'localhost';
  return { server, firstRequest, url: `http://${hostname}:${port}/webhook` };
}

test.describe('Webhook — triggered on incoming mail', () => {
  const WEBHOOK_PORT = 19876;
  let jwt: string;
  let address: string;

  test.beforeAll(async ({ request }) => {
    ({ jwt, address } = await createTestAddress(request, 'webhook-trigger'));
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('webhook is called with correct payload when mail arrives', async ({ request }) => {
    const { server, firstRequest, url } = await startWebhookReceiver(WEBHOOK_PORT);

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

      const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
        data: { from, to: address, raw },
      });
      expect(res.ok()).toBe(true);

      // Wait for webhook to be called
      const received = await firstRequest;
      expect(received.method).toBe('POST');

      const payload = JSON.parse(received.body);
      expect(payload.from).toContain('webhook-sender@test.example.com');
      expect(payload.to).toBe(address);
      expect(payload.subject).toBe(subject);
    } finally {
      server.close();
    }
  });

  test('webhook is NOT called when disabled', async ({ request }) => {
    const { server, firstRequest, url } = await startWebhookReceiver(WEBHOOK_PORT + 1);

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

      const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
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
