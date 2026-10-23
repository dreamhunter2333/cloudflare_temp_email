import { test, expect } from '@playwright/test';
import { ImapFlow } from 'imapflow';
import { createTestAddress, seedTestMail, sendTestMail, deleteAddress, deleteAllMailpitMessages, onMailpitMessage } from '../../fixtures/test-helpers';

const IMAP_HOST = process.env.SMTP_PROXY_HOST || 'smtp-proxy';
const IMAP_PORT = parseInt(process.env.SMTP_PROXY_IMAP_PORT || '11143', 10);

function createClient(user: string, pass: string) {
  return new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: false,
    auth: { user, pass },
    logger: false,
  });
}

test.describe('IMAP Proxy', () => {
  let jwt: string;
  let address: string;

  test.beforeAll(async ({ request }) => {
    ({ jwt, address } = await createTestAddress(request, 'imap-e2e'));
    await seedTestMail(request, address, { subject: 'IMAP Test 1', text: 'First test email' });
    await seedTestMail(request, address, { subject: 'IMAP Test 2', text: 'Second test email' });
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('login with JWT token', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    expect(client.usable).toBe(true);
    await client.logout();
  });

  test('login with wrong password fails', async () => {
    const client = createClient(address, 'wrong-password');
    await expect(client.connect()).rejects.toThrow();
  });

  test('LIST returns INBOX', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const mailboxes = await client.list();
    const names = mailboxes.map(m => m.path);
    expect(names).toContain('INBOX');
    await client.logout();
  });

  test('SELECT INBOX returns message count', async () => {
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

  test('STATUS returns MESSAGES and UIDNEXT', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const status = await client.status('INBOX', { messages: true, uidNext: true });
    expect(status.messages).toBeGreaterThanOrEqual(2);
    expect(status.uidNext).toBeGreaterThan(0);
    await client.logout();
  });

  test('FETCH headers returns Subject', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const msg = await client.fetchOne('1', { headers: true });
      const headers = msg.headers.toString();
      expect(headers).toContain('Subject:');
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('FETCH body returns content', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const msg = await client.fetchOne('1', { source: true });
      expect(msg.source.length).toBeGreaterThan(0);
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('SEARCH ALL returns message numbers', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const results = await client.search({ all: true });
      expect(results.length).toBeGreaterThanOrEqual(2);
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('STORE sets flags', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const result = await client.messageFlagsAdd('1', ['\\Seen']);
      expect(result).toBe(true);
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('UID FETCH works', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const results = await client.search({ all: true });
      expect(results.length).toBeGreaterThan(0);
      const seqMsg = await client.fetchOne(String(results[0]), { uid: true, flags: true });
      expect(seqMsg.uid).toBeGreaterThan(0);
      const uidMsg = await client.fetchOne(String(seqMsg.uid), { uid: true, flags: true }, { uid: true });
      expect(uidMsg.uid).toBe(seqMsg.uid);
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('FETCH source contains valid MIME with Content-Type and seeded body', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const msg = await client.fetchOne('1', { source: true, envelope: true });
      const source = msg.source.toString('utf-8');
      expect(source).toContain('Content-Type:');
      expect(source).toContain('Subject:');
      // No duplicate From headers (regression: getBodyFile returned full MIME)
      const fromMatches = source.match(/^From:/gm);
      expect(fromMatches).toHaveLength(1);
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('RFC822.SIZE matches actual source length', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const msg = await client.fetchOne('1', { source: true, size: true });
      const source = msg.source.toString('utf-8');
      expect(msg.size).toBe(Buffer.byteLength(source, 'utf-8'));
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('FETCH all messages returns correct sequence numbers', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const messages: { seq: number; uid: number }[] = [];
      for await (const msg of client.fetch('1:*', { uid: true })) {
        messages.push({ seq: msg.seq, uid: msg.uid });
      }
      expect(messages.length).toBeGreaterThanOrEqual(2);
      // Sequence numbers must be consecutive starting from 1
      for (let i = 0; i < messages.length; i++) {
        expect(messages[i].seq).toBe(i + 1);
      }
      // UIDs must be strictly ascending
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].uid).toBeGreaterThan(messages[i - 1].uid);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('LIST returns SENT mailbox', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const mailboxes = await client.list();
    const names = mailboxes.map(m => m.path);
    expect(names).toContain('SENT');
    await client.logout();
  });

  test('SELECT INBOX includes UIDVALIDITY and UIDNEXT', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      expect(client.mailbox!.uidValidity).toBeGreaterThan(0);
      expect(client.mailbox!.uidNext).toBeGreaterThan(0);
    } finally {
      lock.release();
    }
    await client.logout();
  });
});

test.describe('IMAP Proxy — SENT mailbox', () => {
  let jwt: string;
  let address: string;
  const sentSubject = `IMAP Sent Test ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    await deleteAllMailpitMessages(request);
    ({ jwt, address } = await createTestAddress(request, 'imap-sent'));

    const listener = onMailpitMessage((m) => m.Subject === sentSubject);
    await listener.ready;

    await sendTestMail(request, address, {
      to_mail: `recipient@test.example.com`,
      subject: sentSubject,
      content: 'E2E sent mail body',
    });
    await listener.message;
  });

  test.afterAll(async ({ request }) => {
    await deleteAddress(request, jwt);
  });

  test('SELECT SENT returns message count', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('SENT');
    try {
      expect(client.mailbox).toBeTruthy();
      expect(client.mailbox!.exists).toBeGreaterThanOrEqual(1);
    } finally {
      lock.release();
    }
    await client.logout();
  });

  test('FETCH SENT source contains valid MIME', async () => {
    const client = createClient(address, jwt);
    await client.connect();
    const lock = await client.getMailboxLock('SENT');
    try {
      const msg = await client.fetchOne('1', { source: true, envelope: true });
      const source = msg.source.toString('utf-8');
      expect(source.length).toBeGreaterThan(50);
      expect(source).toContain('Content-Type:');
      expect(source).toContain('Subject:');
    } finally {
      lock.release();
    }
    await client.logout();
  });
});
