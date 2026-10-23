import { test, expect } from '@playwright/test';
import nodemailer from 'nodemailer';
import {
  createTestAddress,
  deleteAddress,
  deleteAllMailpitMessages,
  requestSendAccess,
  onMailpitMessage,
  WORKER_URL,
} from '../../fixtures/test-helpers';

const SMTP_HOST = process.env.SMTP_PROXY_HOST || 'smtp-proxy';
const SMTP_PORT = parseInt(process.env.SMTP_PROXY_SMTP_PORT || '8025', 10);

function createTransport(user: string, pass: string) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

test.describe('SMTP Proxy', () => {
  let jwt: string;
  let address: string;

  test.beforeAll(async ({ request }) => {
    await deleteAllMailpitMessages(request);
    ({ jwt, address } = await createTestAddress(request, 'smtp-e2e'));
    await requestSendAccess(request, jwt);
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('send plain text email via SMTP', async ({ request }) => {
    const subject = `SMTP Plain ${Date.now()}`;
    const listener = onMailpitMessage((m) => m.Subject === subject);
    await listener.ready;

    const transport = createTransport(address, jwt);
    const info = await transport.sendMail({
      from: address,
      to: 'recipient@test.example.com',
      subject,
      text: 'Hello from SMTP E2E test',
    });
    expect(info.accepted).toContain('recipient@test.example.com');

    const delivered = await listener.message;
    expect(delivered.Subject).toBe(subject);
  });

  test('send HTML email via SMTP', async ({ request }) => {
    const subject = `SMTP HTML ${Date.now()}`;
    const listener = onMailpitMessage((m) => m.Subject === subject);
    await listener.ready;

    const transport = createTransport(address, jwt);
    const info = await transport.sendMail({
      from: address,
      to: 'recipient@test.example.com',
      subject,
      html: '<h1>Hello</h1><p>HTML E2E test</p>',
    });
    expect(info.accepted).toContain('recipient@test.example.com');

    const delivered = await listener.message;
    expect(delivered.Subject).toBe(subject);
  });

  test('auth with wrong password fails', async () => {
    const transport = createTransport(address, 'wrong-password');
    await expect(
      transport.sendMail({
        from: address,
        to: 'recipient@test.example.com',
        subject: 'Should fail',
        text: 'This should not be sent',
      })
    ).rejects.toThrow();
  });

  test('sent mail appears in sendbox API', async ({ request }) => {
    const subject = `SMTP Sendbox ${Date.now()}`;
    const listener = onMailpitMessage((m) => m.Subject === subject);
    await listener.ready;

    const transport = createTransport(address, jwt);
    await transport.sendMail({
      from: address,
      to: 'recipient@test.example.com',
      subject,
      text: 'Check sendbox',
    });
    await listener.message;

    const res = await request.get(`${WORKER_URL}/api/sendbox?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(res.ok()).toBe(true);
    const { results } = await res.json();
    const found = results.some((r: any) => {
      const raw = JSON.parse(r.raw);
      return raw.subject === subject;
    });
    expect(found).toBe(true);
  });
});
