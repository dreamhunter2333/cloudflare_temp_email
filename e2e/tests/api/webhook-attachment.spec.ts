import { test, expect } from '@playwright/test';
import http from 'node:http';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
} from '../../fixtures/test-helpers';

/**
 * Start a temporary HTTP server that records incoming requests.
 */
async function startWebhookReceiver(): Promise<{
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

  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to resolve port');
  const hostname = process.env.CI ? 'e2e-runner' : 'localhost';
  return { server, firstRequest, url: `http://${hostname}:${addr.port}/webhook` };
}

/**
 * Build a MIME message with a text/plain attachment.
 */
function buildMimeWithAttachment(
  from: string, to: string, subject: string, messageId: string,
  attachmentFilename: string, attachmentContent: string
): string {
  const boundary = `----E2EAttachment${Date.now()}`;
  // Base64-encode the attachment content
  const base64Content = Buffer.from(attachmentContent).toString('base64');
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    `Email body with attachment`,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8; name="${attachmentFilename}"`,
    `Content-Disposition: attachment; filename="${attachmentFilename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Content,
    `--${boundary}--`,
  ].join('\r\n');
}

test.describe('Webhook — attachment push', () => {
  let jwt: string;
  let address: string;

  test.beforeAll(async ({ request }) => {
    ({ jwt, address } = await createTestAddress(request, 'webhook-att'));
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('webhook payload includes base64-encoded attachments', async ({ request }) => {
    const { server, firstRequest, url } = await startWebhookReceiver();

    try {
      // Configure webhook with ${attachments} in the body template
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
            attachments: '${attachments}',
          }),
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Send mail with attachment via receive_mail endpoint
      const from = 'att-sender@test.example.com';
      const subject = `Attachment Test ${Date.now()}`;
      const messageId = `<att-${Date.now()}@test>`;
      const attachmentContent = 'Hello from attachment!';
      const raw = buildMimeWithAttachment(
        from, address, subject, messageId,
        'test-file.txt', attachmentContent
      );

      const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
        data: { from, to: address, raw },
      });
      expect(res.ok()).toBe(true);

      // Wait for webhook to be called
      const received = await firstRequest;
      const payload = JSON.parse(received.body);

      expect(payload.from).toContain('att-sender@test.example.com');
      expect(payload.to).toBe(address);
      expect(payload.subject).toBe(subject);

      // Parse attachments — should be a JSON string of array
      const attachments = JSON.parse(payload.attachments);
      expect(Array.isArray(attachments)).toBe(true);
      expect(attachments.length).toBeGreaterThanOrEqual(1);

      const att = attachments[0];
      expect(att.filename).toBe('test-file.txt');
      expect(att.mimeType).toContain('text/plain');
      expect(att.disposition).toBe('attachment');

      // Decode base64 content and verify
      const decoded = Buffer.from(att.content, 'base64').toString('utf-8');
      expect(decoded).toBe(attachmentContent);
    } finally {
      server.close();
    }
  });

  test('webhook payload has empty attachments for mail without attachments', async ({ request }) => {
    const { server, firstRequest, url } = await startWebhookReceiver();

    try {
      // Configure webhook
      const saveRes = await request.post(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: true,
          url,
          method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            subject: '${subject}',
            attachments: '${attachments}',
          }),
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Send plain text mail (no attachment)
      const from = 'no-att-sender@test.example.com';
      const subject = `No Attachment ${Date.now()}`;
      const messageId = `<noatt-${Date.now()}@test>`;
      const raw = [
        `From: ${from}`,
        `To: ${address}`,
        `Subject: ${subject}`,
        `Message-ID: ${messageId}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `Plain text body, no attachments`,
      ].join('\r\n');

      const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
        data: { from, to: address, raw },
      });
      expect(res.ok()).toBe(true);

      const received = await firstRequest;
      const payload = JSON.parse(received.body);

      expect(payload.subject).toBe(subject);

      const attachments = JSON.parse(payload.attachments);
      expect(Array.isArray(attachments)).toBe(true);
      expect(attachments.length).toBe(0);
    } finally {
      server.close();
    }
  });

  test('webhook payload includes multiple attachments', async ({ request }) => {
    const { server, firstRequest, url } = await startWebhookReceiver();

    try {
      const saveRes = await request.post(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: true,
          url,
          method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            subject: '${subject}',
            attachments: '${attachments}',
          }),
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Build MIME with two attachments
      const from = 'multi-att@test.example.com';
      const subject = `Multi Attachment ${Date.now()}`;
      const messageId = `<multi-att-${Date.now()}@test>`;
      const boundary = `----MultiAtt${Date.now()}`;
      const att1Content = Buffer.from('File one content').toString('base64');
      const att2Content = Buffer.from('File two content').toString('base64');
      const raw = [
        `From: ${from}`,
        `To: ${address}`,
        `Subject: ${subject}`,
        `Message-ID: ${messageId}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `Body with two attachments`,
        `--${boundary}`,
        `Content-Type: application/pdf; name="doc.pdf"`,
        `Content-Disposition: attachment; filename="doc.pdf"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        att1Content,
        `--${boundary}`,
        `Content-Type: image/png; name="image.png"`,
        `Content-Disposition: attachment; filename="image.png"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        att2Content,
        `--${boundary}--`,
      ].join('\r\n');

      const res = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
        data: { from, to: address, raw },
      });
      expect(res.ok()).toBe(true);

      const received = await firstRequest;
      const payload = JSON.parse(received.body);
      const attachments = JSON.parse(payload.attachments);

      expect(attachments.length).toBe(2);
      expect(attachments[0].filename).toBe('doc.pdf');
      expect(attachments[0].mimeType).toBe('application/pdf');
      expect(attachments[1].filename).toBe('image.png');
      expect(attachments[1].mimeType).toBe('image/png');

      // Verify decoded content
      expect(Buffer.from(attachments[0].content, 'base64').toString('utf-8')).toBe('File one content');
      expect(Buffer.from(attachments[1].content, 'base64').toString('utf-8')).toBe('File two content');
    } finally {
      server.close();
    }
  });
});
