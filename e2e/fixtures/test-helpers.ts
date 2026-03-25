import { APIRequestContext } from '@playwright/test';
import WebSocket from 'ws';

export const WORKER_URL = process.env.WORKER_URL!;
export const FRONTEND_URL = process.env.FRONTEND_URL!;
export const MAILPIT_API = process.env.MAILPIT_API!;
export const TEST_DOMAIN = 'test.example.com';

/**
 * Create a new email address via the worker API.
 * Appends a timestamp suffix to avoid UNIQUE constraint collisions
 * with persistent D1 data from previous test runs.
 * Returns the JWT and full address string.
 */
export async function createTestAddress(
  ctx: APIRequestContext,
  name: string,
  domain: string = TEST_DOMAIN
): Promise<{ jwt: string; address: string; address_id: number }> {
  const uniqueName = `${name}${Date.now()}`;
  const res = await ctx.post(`${WORKER_URL}/api/new_address`, {
    data: { name: uniqueName, domain },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create address: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return { jwt: body.jwt, address: body.address, address_id: body.address_id };
}

/**
 * Seed a test email by exercising the real worker email() handler
 * via the admin test endpoint.
 */
export async function seedTestMail(
  ctx: APIRequestContext,
  address: string,
  opts: { subject?: string; html?: string; text?: string; from?: string }
): Promise<void> {
  const from = opts.from || `sender@${TEST_DOMAIN}`;
  const subject = opts.subject || 'Test Email';
  const boundary = `----E2E${Date.now()}`;
  const htmlPart = opts.html || `<p>${opts.text || 'Hello from E2E'}</p>`;
  const textPart = opts.text || 'Hello from E2E';
  const messageId = `<e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test>`;

  const raw = [
    `From: ${from}`,
    `To: ${address}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    textPart,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlPart,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await ctx.post(`${WORKER_URL}/admin/test/receive_mail`, {
    data: { from, to: address, raw },
  });
  if (!res.ok()) {
    throw new Error(`Failed to seed mail: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.success) {
    throw new Error(`Mail was rejected: ${body.rejected || 'unknown reason'}`);
  }
}

/**
 * Send a mail via admin/send_mail, which saves to sendbox.
 */
export async function sendTestMail(
  ctx: APIRequestContext,
  fromAddress: string,
  opts: { to_mail: string; subject?: string; content?: string; is_html?: boolean }
): Promise<void> {
  const res = await ctx.post(`${WORKER_URL}/admin/send_mail`, {
    data: {
      from_name: '',
      from_mail: fromAddress,
      to_name: '',
      to_mail: opts.to_mail,
      subject: opts.subject || 'Test Sent Mail',
      content: opts.content || 'Sent mail body from E2E',
      is_html: opts.is_html ?? false,
    },
  });
  if (!res.ok()) {
    throw new Error(`Failed to send mail: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Delete all messages in Mailpit.
 */
export async function deleteAllMailpitMessages(ctx: APIRequestContext) {
  const res = await ctx.delete(`${MAILPIT_API}/v1/messages`);
  if (!res.ok()) {
    throw new Error(`Failed to delete Mailpit messages: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Derive the Mailpit WebSocket URL from the REST API URL.
 * MAILPIT_API is like "http://mailpit:8025/api" → ws://mailpit:8025/api/events
 */
function mailpitWsUrl(): string {
  return MAILPIT_API.replace(/^http/, 'ws') + '/events';
}

/**
 * Wait for a message matching `predicate` to arrive in Mailpit.
 *
 * Connects to Mailpit's WebSocket `/api/events` and listens for
 * `Type: "new"` events. When a matching message arrives, resolves
 * immediately — no polling, no arbitrary sleeps.
 *
 * Returns `{ ready, message }`:
 * - `ready` resolves when the WebSocket connection is open
 * - `message` resolves with the matched message summary
 *
 * Usage: await ready before triggering the send to avoid race conditions.
 */
export function onMailpitMessage(
  predicate: (msg: any) => boolean,
  { timeout = 10_000 }: { timeout?: number } = {}
): { ready: Promise<void>; message: Promise<any> } {
  let readyResolve: () => void;
  let readyReject: (err: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const message = new Promise<any>((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(mailpitWsUrl());
    const timer = setTimeout(() => {
      ws.close();
      if (!settled) { settled = true; reject(new Error('Mailpit message not received within timeout')); }
    }, timeout);

    ws.on('open', () => readyResolve());

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.Type === 'new' && predicate(event.Data)) {
          clearTimeout(timer);
          ws.close();
          if (!settled) { settled = true; resolve(event.Data); }
        }
      } catch { /* ignore parse errors */ }
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(new Error('Mailpit WebSocket closed before matching message')); }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timer);
      readyReject(err);
      if (!settled) { settled = true; reject(err); }
    });
  });

  return { ready, message };
}

/**
 * Request send mail access for an address.
 * Must be called before sending mail — creates the address_sender row
 * with the DEFAULT_SEND_BALANCE configured in the worker.
 */
export async function requestSendAccess(
  ctx: APIRequestContext,
  jwt: string
): Promise<void> {
  const res = await ctx.post(`${WORKER_URL}/api/request_send_mail_access`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to request send access: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Delete a test address via its JWT.
 */
export async function deleteAddress(
  ctx: APIRequestContext,
  jwt: string
): Promise<void> {
  const res = await ctx.delete(`${WORKER_URL}/api/delete_address`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to delete address: ${res.status()} ${await res.text()}`);
  }
}
