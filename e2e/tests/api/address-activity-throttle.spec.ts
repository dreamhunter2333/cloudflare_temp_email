import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  WORKER_URL,
  WORKER_URL_ENV_OFF,
  onMailpitMessage,
  createTestAddress,
  deleteAddress,
  hashPassword,
} from '../../fixtures/test-helpers';

const waitForNextTimestamp = () => new Promise((resolve) => setTimeout(resolve, 1_100));

test.describe('Address activity throttling', () => {
  test('does not rewrite recently active addresses from user settings', async ({ request }) => {
    const email = `activity-throttle-${Date.now()}@test.example.com`;
    const password = hashPassword('test-password-123');
    const address = await createTestAddress(request, 'activity-throttle');
    let userId: number | undefined;

    try {
      const settingsRes = await request.post(`${WORKER_URL}/admin/user_settings`, {
        data: { enable: true, enableMailVerify: false },
      });
      expect(settingsRes.ok()).toBe(true);

      const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
        data: { email, password },
      });
      expect(registerRes.ok()).toBe(true);

      const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
        data: { email, password },
      });
      expect(loginRes.ok()).toBe(true);
      const { jwt: userJwt } = await loginRes.json();
      const payload = JSON.parse(Buffer.from(userJwt.split('.')[1], 'base64url').toString('utf8'));
      userId = payload.user_id;

      const bindRes = await request.post(`${WORKER_URL}/user_api/bind_address`, {
        headers: {
          Authorization: `Bearer ${address.jwt}`,
          'x-user-token': userJwt,
        },
      });
      expect(bindRes.ok()).toBe(true);

      const beforeRes = await request.get(`${WORKER_URL}/user_api/bind_address`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(beforeRes.ok()).toBe(true);
      const before = await beforeRes.json();
      const initialUpdatedAt = before.results.find(
        (row: { name: string }) => row.name === address.address,
      )?.updated_at;
      expect(initialUpdatedAt).toBeTruthy();

      await waitForNextTimestamp();
      const userSettingsRes = await request.get(`${WORKER_URL}/user_api/settings`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(userSettingsRes.ok()).toBe(true);
      await waitForNextTimestamp();

      const afterRes = await request.get(`${WORKER_URL}/user_api/bind_address`, {
        headers: { 'x-user-token': userJwt },
      });
      expect(afterRes.ok()).toBe(true);
      const after = await afterRes.json();
      const updatedAt = after.results.find(
        (row: { name: string }) => row.name === address.address,
      )?.updated_at;
      expect(updatedAt).toBe(initialUpdatedAt);
    } finally {
      await deleteAddress(request, address.jwt);
      if (userId) {
        const deleteUserRes = await request.delete(`${WORKER_URL}/admin/users/${userId}`);
        expect(deleteUserRes.ok()).toBe(true);
      }
    }
  });
});

const OLD = '2020-01-01 00:00:00';
const RECENT = new Date(Date.now() - 3_600_000).toISOString().replace('T', ' ').slice(0, 19);
type Mailbox = { address: string; address_id: number; jwt: string; password: string };
type User = { id: number; email: string; jwt: string };

for (const { base, disabled } of [
  { base: WORKER_URL, disabled: false },
  { base: WORKER_URL_ENV_OFF, disabled: true },
]) {
  test.describe(`Address activity disabled: ${disabled}`, () => {
    let mailboxes: Mailbox[];
    let users: User[];
    let orphanAddresses: string[];
    let originalUserSettings: Record<string, unknown>;

    async function call(request: APIRequestContext, path: string,
      options: Parameters<APIRequestContext['fetch']>[1] = {}, status = 200) {
      const response = await request.fetch(`${base}${path}`, options);
      expect(response.status(), await response.text()).toBe(status);
      return response;
    }
    async function list(request: APIRequestContext, path: string, query: Record<string, string>) {
      return (await call(request, path, { params: { limit: '100', offset: '0', ...query } })).json();
    }
    async function addressRow(request: APIRequestContext, mailbox: Mailbox) {
      return (await list(request, '/admin/address', { query: mailbox.address })).results
        .find((row: { name: string }) => row.name === mailbox.address);
    }
    async function newMailbox(request: APIRequestContext) {
      const response = await call(request, '/admin/new_address', {
        method: 'POST', data: { name: `activity${Date.now()}${mailboxes.length}`, domain: 'test.example.com' },
      });
      const mailbox: Mailbox = await response.json();
      mailboxes.push(mailbox);
      return mailbox;
    }
    async function newUser(request: APIRequestContext) {
      const email = `activity${Date.now()}${users.length}@test.example.com`;
      const password = hashPassword('test-password-123');
      await call(request, '/admin/users', { method: 'POST', data: { email, password } });
      const response = await call(request, '/user_api/login', { method: 'POST', data: { email, password } });
      const { jwt } = await response.json();
      const { user_id: id } = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
      const user = { id, email, jwt };
      users.push(user);
      return user;
    }
    const addressAuth = (mailbox: Mailbox) => ({ Authorization: `Bearer ${mailbox.jwt}` });
    const userAuth = (user: User) => ({ 'x-user-token': user.jwt });
    async function bind(request: APIRequestContext, mailbox: Mailbox, user: User) {
      await call(request, '/admin/users/bind_address', {
        method: 'POST', data: { user_id: user.id, address_id: mailbox.address_id },
      });
    }
    async function seed(request: APIRequestContext, mailbox: Mailbox, updatedAt: string | null = OLD, createdAt?: string) {
      await call(request, '/admin/test/seed_mail', {
        method: 'POST', data: {
          address: mailbox.address, raw: `From: sender@test.example.com\r\nTo: ${mailbox.address}\r\nSubject: activity\r\n\r\nBody`,
          address_updated_at: updatedAt, address_created_at: createdAt, created_at: OLD,
        },
      });
      expect((await addressRow(request, mailbox)).updated_at).toBe(updatedAt);
    }
    async function expectActivity(request: APIRequestContext, mailbox: Mailbox, previous: string | null) {
      if (disabled || previous === RECENT) {
        await waitForNextTimestamp();
        expect((await addressRow(request, mailbox)).updated_at).toBe(previous);
        return;
      }
      await expect.poll(async () => (await addressRow(request, mailbox)).updated_at).not.toBe(previous);
      expect((await addressRow(request, mailbox)).updated_at).toBeTruthy();
    }
    async function send(request: APIRequestContext, mailbox: Mailbox, user?: User) {
      const subject = `Activity ${disabled} ${Date.now()}`;
      const listener = onMailpitMessage(mail => mail.Subject === subject);
      await listener.ready;
      const [, delivered] = await Promise.all([
        call(request, user ? `/user_api/address/${mailbox.address_id}/send_mail` : '/api/send_mail', {
          method: 'POST', headers: user ? userAuth(user) : addressAuth(mailbox),
          data: { to_mail: 'recipient@test.example.com', subject, content: 'Activity test', is_html: false },
        }),
        listener.message,
      ]);
      expect(delivered.From.Address).toBe(mailbox.address);
    }
    async function relatedCounts(request: APIRequestContext, mailbox: Mailbox, user: User) {
      const address = await addressRow(request, mailbox);
      const inbox = await list(request, '/admin/mails', { address: mailbox.address });
      const sent = await list(request, '/admin/sendbox', { address: mailbox.address });
      const sender = await list(request, '/admin/address_sender', { address: mailbox.address });
      const reply = await (await call(request, '/api/auto_reply', { headers: addressAuth(mailbox) })).json();
      const bound = await (await call(request, '/user_api/bind_address', { headers: userAuth(user) })).json();
      return [Number(!!address), inbox.count, sent.count, sender.count, Number(!!reply.subject),
        bound.results.filter((row: { name: string }) => row.name === mailbox.address).length];
    }
    async function prepareRelated(request: APIRequestContext) {
      const mailbox = await newMailbox(request);
      const user = await newUser(request);
      await bind(request, mailbox, user);
      await call(request, '/api/auto_reply', {
        method: 'POST', headers: addressAuth(mailbox),
        data: { auto_reply: { subject: 'Reply', message: 'Body', enabled: false } },
      });
      await send(request, mailbox);
      await seed(request, mailbox);
      expect(await relatedCounts(request, mailbox, user)).toEqual([1, 1, 1, 1, 1, 1]);
      return { mailbox, user };
    }

    test.beforeAll(async ({ request }) => {
      expect(base).toBeTruthy();
      originalUserSettings = await (await call(request, '/admin/user_settings')).json();
      await call(request, '/admin/user_settings', {
        method: 'POST', data: { ...originalUserSettings, enable: true, enableMailVerify: false },
      });
    });
    test.afterAll(async ({ request }) => {
      await call(request, '/admin/user_settings', { method: 'POST', data: originalUserSettings });
    });
    test.beforeEach(() => {
      expect(base).toBeTruthy();
      mailboxes = [];
      users = [];
      orphanAddresses = [];
    });
    test.afterEach(async ({ request }) => {
      for (const mailbox of mailboxes) {
        const row = await addressRow(request, mailbox);
        if (row) await call(request, `/admin/delete_address/${row.id}`, { method: 'DELETE' });
      }
      for (const user of users) await call(request, `/admin/users/${user.id}`, { method: 'DELETE' });
      for (const address of orphanAddresses) {
        const mails = await list(request, '/admin/mails', { address });
        for (const mail of mails.results) await call(request, `/admin/mails/${mail.id}`, { method: 'DELETE' });
      }
    });

    test('repeated user settings reads respect activity tracking and ownership', async ({ request }) => {
      const user = await newUser(request);
      const otherUser = await newUser(request);
      for (const [index, previous] of [OLD, null, RECENT, OLD, OLD].entries()) {
        const mailbox = await newMailbox(request);
        if (index < 3) await bind(request, mailbox, user);
        if (index === 4) await bind(request, mailbox, otherUser);
        await seed(request, mailbox, previous);
      }
      await call(request, '/user_api/settings', { headers: userAuth(user) });
      await expectActivity(request, mailboxes[0], OLD);
      const after = await Promise.all(mailboxes.map(mailbox => addressRow(request, mailbox)));
      expect(after.map(row => row.updated_at).slice(2)).toEqual([RECENT, OLD, OLD]);
      if (disabled) expect(after[1].updated_at).toBeNull();
      else expect(after[1].updated_at).toBeTruthy();
      await call(request, '/user_api/settings', { headers: userAuth(user) });
      await waitForNextTimestamp();
      expect(await Promise.all(mailboxes.map(mailbox => addressRow(request, mailbox)))).toEqual(after);
    });

    for (const path of ['/api/settings', '/api/mails?limit=20&offset=0', '/api/parsed_mails?limit=20&offset=0']) {
      test(`${path} respects the switch for stale, null and recent activity`, async ({ request }) => {
        const mailbox = await newMailbox(request);
        const other = await newMailbox(request);
        await seed(request, other);
        for (const previous of [OLD, null, RECENT]) {
          await seed(request, mailbox, previous);
          await call(request, path, { headers: addressAuth(mailbox) });
          await expectActivity(request, mailbox, previous);
          expect((await addressRow(request, other)).updated_at).toBe(OLD);
        }
      });
    }

    test('later inbox pages do not refresh activity', async ({ request }) => {
      const mailbox = await newMailbox(request);
      await seed(request, mailbox);
      for (const path of ['/api/mails?limit=20&offset=20', '/api/parsed_mails?limit=20&offset=20']) {
        await call(request, path, { headers: addressAuth(mailbox) });
      }
      await waitForNextTimestamp();
      expect((await addressRow(request, mailbox)).updated_at).toBe(OLD);
    });

    test('incoming mail is stored and both send APIs respect activity tracking', async ({ request }) => {
      const mailbox = await newMailbox(request);
      const user = await newUser(request);
      await bind(request, mailbox, user);
      await seed(request, mailbox);
      const raw = `From: sender@test.example.com\r\nTo: ${mailbox.address}\r\nSubject: incoming\r\n\r\nBody`;
      const received = await call(request, '/admin/test/receive_mail', {
        method: 'POST', data: { from: 'sender@test.example.com', to: mailbox.address, raw },
      });
      expect((await received.json()).success).toBe(true);
      expect((await list(request, '/admin/mails', { address: mailbox.address })).count).toBe(2);
      expect((await addressRow(request, mailbox)).updated_at).toBe(OLD);
      for (const sender of [undefined, user]) {
        await seed(request, mailbox);
        await send(request, mailbox, sender);
        await expectActivity(request, mailbox, OLD);
      }
      const sender = await list(request, '/admin/address_sender', { address: mailbox.address });
      expect(sender.results[0].balance).toBe(8);
      expect((await list(request, '/admin/sendbox', { address: mailbox.address })).count).toBe(2);
    });

    test('password generation, password changes and admin resets keep working', async ({ request }) => {
      const mailbox = await newMailbox(request);
      expect(mailbox.password).toBeTruthy();
      expect((await addressRow(request, mailbox)).updated_at).toBeTruthy();
      await call(request, '/api/address_login', {
        method: 'POST', data: { email: mailbox.address, password: hashPassword(mailbox.password) },
      });
      for (const path of ['/api/address_change_password', `/admin/address/${mailbox.address_id}/reset_password`]) {
        await seed(request, mailbox);
        const password = hashPassword(`password-${path}`);
        await call(request, path, {
          method: 'POST', headers: addressAuth(mailbox), data: { password, new_password: password },
        });
        expect((await addressRow(request, mailbox)).updated_at).not.toBe(OLD);
        await call(request, '/api/address_login', { method: 'POST', data: { email: mailbox.address, password } });
      }
    });

    test('address transfer still initializes its timestamp and changes ownership', async ({ request }) => {
      const mailbox = await newMailbox(request);
      const user = await newUser(request);
      const target = await newUser(request);
      await bind(request, mailbox, user);
      await seed(request, mailbox);
      await call(request, '/user_api/transfer_address', {
        method: 'POST', headers: userAuth(user), data: { address_id: mailbox.address_id, target_user_email: target.email },
      });
      const transferred = await addressRow(request, mailbox);
      expect(transferred.id).not.toBe(mailbox.address_id);
      expect(transferred.updated_at).toBeTruthy();
      expect(transferred.updated_at).not.toBe(OLD);
      const bindings = await (await call(request, '/user_api/bind_address', { headers: userAuth(target) })).json();
      expect(bindings.results.map((row: { name: string }) => row.name)).toContain(mailbox.address);
    });

    test('manual inactivity cleanup protects the address and all related data when disabled', async ({ request }) => {
      const { mailbox, user } = await prepareRelated(request);
      for (const lang of ['en', 'zh']) {
        const response = await call(request, '/admin/cleanup', {
          method: 'POST', headers: { 'x-lang': lang }, data: { cleanType: 'inactiveAddress', cleanDays: 1 },
        }, disabled ? 500 : 200);
        if (disabled) expect(await response.text()).toBe(lang === 'zh'
          ? '清理失败，请检查清理配置；禁用地址活跃时间更新时，无法按不活跃时间清理。'
          : 'Cleanup failed. Check your cleanup settings; inactive-address cleanup is unavailable when address activity updates are disabled.');
        else expect(await response.json()).toEqual({ success: true });
        expect(await relatedCounts(request, mailbox, user)).toEqual(disabled ? [1, 1, 1, 1, 1, 1] : [0, 0, 0, 0, 0, 0]);
      }
    });

    test('scheduled inactivity cleanup respects the switch and continues later cleanup', async ({ request }) => {
      const { mailbox, user } = await prepareRelated(request);
      const created = await newMailbox(request);
      await seed(request, created, RECENT, OLD);
      const original = await (await call(request, '/admin/auto_cleanup')).json();
      try {
        await call(request, '/admin/auto_cleanup', { method: 'POST', data: {
          enableInactiveAddressAutoCleanup: true, cleanInactiveAddressDays: 1,
          enableAddressAutoCleanup: true, cleanAddressDays: 1,
        } });
        await call(request, '/__scheduled');
        expect(await relatedCounts(request, mailbox, user)).toEqual(disabled ? [1, 1, 1, 1, 1, 1] : [0, 0, 0, 0, 0, 0]);
        expect(await addressRow(request, created)).toBeUndefined();
      } finally {
        await call(request, '/admin/auto_cleanup', { method: 'POST', data: original || {} });
      }
    });

    for (const cleanType of ['addressCreated', 'unboundAddress', 'emptyAddress', 'mails', 'mails_unknow', 'sendbox']) {
      test(`${cleanType} cleanup remains available`, async ({ request }) => {
        const mailbox = await newMailbox(request);
        await seed(request, mailbox, RECENT, OLD);
        let queryAddress = mailbox.address;
        if (cleanType === 'emptyAddress') await call(request, `/admin/clear_inbox/${mailbox.address_id}`, { method: 'DELETE' });
        if (cleanType === 'mails_unknow') {
          queryAddress = `unknown${Date.now()}@test.example.com`;
          orphanAddresses.push(queryAddress);
          await call(request, '/admin/test/seed_mail', {
            method: 'POST', data: { address: queryAddress, raw: 'old unknown mail', created_at: OLD },
          });
        }
        if (cleanType === 'sendbox') {
          await send(request, mailbox);
          await waitForNextTimestamp();
        }
        await call(request, '/admin/cleanup', {
          method: 'POST', data: { cleanType, cleanDays: cleanType === 'sendbox' ? 0 : 1 },
        });
        if (['addressCreated', 'unboundAddress', 'emptyAddress'].includes(cleanType)) {
          expect(await addressRow(request, mailbox)).toBeUndefined();
        } else {
          const path = cleanType === 'sendbox' ? '/admin/sendbox' : '/admin/mails';
          expect((await list(request, path, { address: queryAddress })).count).toBe(0);
          expect(await addressRow(request, mailbox)).toBeTruthy();
        }
      });
    }

    test('invalid cleanup requests keep their original error details', async ({ request }) => {
      for (const { data, message } of [
        { data: { cleanType: 'invalid', cleanDays: 1 }, message: 'Operation failed: Invalid cleanType' },
        { data: { cleanType: 'mails', cleanDays: -1 }, message: 'Operation failed: Invalid cleanType or cleanDays' },
      ]) {
        const response = await call(request, '/admin/cleanup', { method: 'POST', data }, 500);
        expect(await response.text()).toBe(message);
      }
    });
  });
}
