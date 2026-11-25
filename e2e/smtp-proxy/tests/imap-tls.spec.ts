import { test, expect } from '@playwright/test';
import { ImapFlow } from 'imapflow';
import { createTestAddress, seedTestMail, deleteAddress } from '../../fixtures/test-helpers';

const IMAP_TLS_HOST = process.env.SMTP_PROXY_TLS_HOST || 'smtp-proxy-tls';
const IMAP_TLS_PORT = parseInt(process.env.SMTP_PROXY_TLS_IMAP_PORT || '11144', 10);

function createClient(user: string, pass: string) {
  return new ImapFlow({
    host: IMAP_TLS_HOST,
    port: IMAP_TLS_PORT,
    secure: false,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
}

test.describe('IMAP Proxy — STARTTLS', () => {
  let jwt: string;
  let address: string;

  test.beforeAll(async ({ request }) => {
    ({ jwt, address } = await createTestAddress(request, 'imap-tls'));
    await seedTestMail(request, address, { subject: 'IMAP TLS Test 1', text: 'First TLS test email' });
    await seedTestMail(request, address, { subject: 'IMAP TLS Test 2', text: 'Second TLS test email' });
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('login with JWT over STARTTLS', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    expect(client.usable).toBe(true);
    await client.logout();
  });

  test('login with wrong password fails over STARTTLS', async () => {
    const client = createClient(address, 'wrong-password');
    await expect(client.connect()).rejects.toThrow();
  });

  test('LIST returns INBOX over STARTTLS', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const mailboxes = await client.list();
    const names = mailboxes.map(m => m.path);
    expect(names).toContain('INBOX');
    await client.logout();
  });

  test('SELECT INBOX returns messages over STARTTLS', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      expect(client.mailbox).toBeTruthy();
      expect(client.mailbox!.exists).toBeGreaterThanOrEqual(2);
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('FETCH source over STARTTLS contains valid MIME', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const msg = await client.fetchOne('1', { source: true });
      const source = msg.source.toString('utf-8');
      expect(source).toContain('Content-Type:');
      expect(source).toContain('Subject:');
    } finally {
      lock.release();
    }
    await client.logout();
  });
});
