import { test, expect } from '@playwright/test';
import nodemailer from 'nodemailer';
import {
  createTestAddress,
  deleteAddress,
  deleteAllMailpitMessages,
  requestSendAccess,
  onMailpitMessage,
} from '../../fixtures/test-helpers';

const TLS_HOST = process.env.SMTP_PROXY_TLS_HOST || 'smtp-proxy-tls';
const TLS_SMTP_PORT = parseInt(process.env.SMTP_PROXY_TLS_SMTP_PORT || '8026', 10);

function createTlsTransport(user: string, pass: string) {
  return nodemailer.createTransport({
    host: TLS_HOST,
    port: TLS_SMTP_PORT,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    requireTLS: true,
  });
}

function createNoTlsTransport(user: string, pass: string) {
  return nodemailer.createTransport({
    host: TLS_HOST,
    port: TLS_SMTP_PORT,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

test.describe('SMTP Proxy — STARTTLS', () => {
  let jwt: string;
  let address: string;

  test.beforeAll(async ({ request }) => {
    await deleteAllMailpitMessages(request);
    ({ jwt, address } = await createTestAddress(request, 'smtp-tls'));
    await requestSendAccess(request, jwt);
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('send plain text email via STARTTLS', async () => {
    const subject = `SMTP TLS Plain ${Date.now()}`;
    const listener = onMailpitMessage((m) => m.Subject === subject);
    await listener.ready;

    const transport = createTlsTransport(address, jwt);
    const info = await transport.sendMail({
      from: address,
      to: 'recipient@test.example.com',
      subject,
      text: 'Hello from SMTP STARTTLS E2E test',
    });
    expect(info.accepted).toContain('recipient@test.example.com');

    const delivered = await listener.message;
    expect(delivered.Subject).toBe(subject);
  });

  test('send HTML email via STARTTLS', async () => {
    const subject = `SMTP TLS HTML ${Date.now()}`;
    const listener = onMailpitMessage((m) => m.Subject === subject);
    await listener.ready;

    const transport = createTlsTransport(address, jwt);
    const info = await transport.sendMail({
      from: address,
      to: 'recipient@test.example.com',
      subject,
      html: '<h1>Hello</h1><p>STARTTLS HTML E2E test</p>',
    });
    expect(info.accepted).toContain('recipient@test.example.com');

    const delivered = await listener.message;
    expect(delivered.Subject).toBe(subject);
  });

  test('connection without STARTTLS still works', async () => {
    const subject = `SMTP TLS NoForce ${Date.now()}`;
    const listener = onMailpitMessage((m) => m.Subject === subject);
    await listener.ready;

    const transport = createNoTlsTransport(address, jwt);
    const info = await transport.sendMail({
      from: address,
      to: 'recipient@test.example.com',
      subject,
      text: 'Hello without forced STARTTLS',
    });
    expect(info.accepted).toContain('recipient@test.example.com');

    const delivered = await listener.message;
    expect(delivered.Subject).toBe(subject);
  });

  test('auth with wrong password fails over STARTTLS', async () => {
    const transport = createTlsTransport(address, 'wrong-password');
    await expect(
      transport.sendMail({
        from: address,
        to: 'recipient@test.example.com',
        subject: 'Should fail',
        text: 'This should not be sent',
      })
    ).rejects.toThrow();
  });
});
