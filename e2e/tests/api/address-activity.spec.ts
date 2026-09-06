import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { WORKER_URL, WORKER_URL_ENV_OFF, hashPassword, onMailpitMessage } from '../../fixtures/test-helpers';

const OLD = '2020-01-01 00:00:00';
const ADDRESS = 'activitye2eold@test.example.com';
const PREFIX = '%activitye2e%';
const FAILURE = {
  en: 'Cleanup failed. Check your cleanup settings; inactive-address cleanup is unavailable when address activity updates are disabled.',
  zh: '清理失败，请检查清理配置；禁用地址活跃时间更新时，无法按不活跃时间清理。',
};

function token(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload, exp: Math.floor(Date.now() / 1000) + 86400,
  })).toString('base64url');
  const data = `${header}.${body}`;
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}

type Statement = { sql: string; params?: unknown[] };

for (const { label, base, secret, value, disabled } of [
  { label: 'unset', base: WORKER_URL, secret: 'e2e-test-secret-key', value: undefined, disabled: false },
  { label: 'false', base: WORKER_URL, secret: 'e2e-test-secret-key', value: false, disabled: false },
  { label: 'string false', base: WORKER_URL, secret: 'e2e-test-secret-key', value: 'false', disabled: false },
  { label: 'true', base: WORKER_URL_ENV_OFF, secret: 'e2e-test-secret-key-env-off', value: undefined, disabled: true },
  { label: 'string true', base: WORKER_URL_ENV_OFF, secret: 'e2e-test-secret-key-env-off', value: 'true', disabled: true },
]) {
  test.describe(`Address activity: ${label}`, () => {
    test.use({ extraHTTPHeaders: {
      'x-e2e-address-activity': 'true',
      ...(value === undefined ? {} : { 'x-e2e-disable-address-updated-at': JSON.stringify(value) }),
    } });
    let ids: number[];
    let userIds: number[];
    const addressAuth = () => ({ Authorization: `Bearer ${token({ address_id: ids[1], address: ADDRESS }, secret)}` });
    const userAuth = () => ({ 'x-user-token': token({ user_id: userIds[0], user_email: 'activitye2euser@test.example.com' }, secret) });

    async function call(
      request: APIRequestContext,
      path: string,
      options: Parameters<APIRequestContext['fetch']>[1] = {},
      status = 200,
    ) {
      const response = await request.fetch(`${base}${path}`, options);
      expect(response.status(), await response.text()).toBe(status);
      return response;
    }
    async function batch(request: APIRequestContext, statements: Statement[]) {
      return (await call(request, '/__e2e/sql', { method: 'POST', data: statements })).json();
    }
    async function rows(request: APIRequestContext, sql: string, params: unknown[] = []) {
      return (await batch(request, [{ sql, params }]))[0].results;
    }
    async function timestamp(request: APIRequestContext, id = ids[1]) {
      return (await rows(request, 'SELECT updated_at FROM address WHERE id = ?', [id]))[0]?.updated_at;
    }
    function expectUpdates(response: APIResponse, count: number) {
      expect(response.headers()['x-e2e-address-updates']).toBe(String(count));
    }
    async function relatedCounts(request: APIRequestContext) {
      const statements = ['address', 'raw_mails', 'sendbox', 'auto_reply_mails', 'address_sender', 'users_address']
        .map(table => ({
          sql: `SELECT count(*) AS count FROM ${table} WHERE ${
            table === 'address' ? 'id' : table === 'users_address' ? 'address_id' : 'address'
          } = ?`,
          params: [table === 'address' || table === 'users_address' ? ids[1] : ADDRESS],
        }));
      return (await batch(request, statements)).map((result: { results: { count: number }[] }) => result.results[0].count);
    }
    async function removeFixtures(request: APIRequestContext) {
      await batch(request, [
        ...['raw_mails', 'sendbox', 'auto_reply_mails', 'address_sender'].map(table => ({
          sql: `DELETE FROM ${table} WHERE address LIKE ?`, params: [PREFIX],
        })),
        { sql: 'DELETE FROM users_address WHERE address_id IN (SELECT id FROM address WHERE name LIKE ?)', params: [PREFIX] },
        { sql: 'DELETE FROM address WHERE name LIKE ?', params: [PREFIX] },
        { sql: 'DELETE FROM users WHERE user_email LIKE ?', params: [PREFIX] },
      ]);
    }

    test.beforeAll(() => {
      expect(base, `Worker URL for ${label} must be configured`).toBeTruthy();
    });
    test.afterEach(async ({ request }) => {
      await removeFixtures(request);
    });
    test.beforeEach(async ({ request }) => {
      await removeFixtures(request);
      const result = await batch(request, [
        { sql: 'INSERT INTO users (user_email,password) VALUES (?,?), (?,?) RETURNING id',
          params: ['activitye2euser@test.example.com', hashPassword('password'), 'activitye2eother@test.example.com', hashPassword('password')] },
        { sql: `INSERT INTO address (name,password,updated_at) VALUES
            (?,?,?), (?,?,NULL), (?,?,datetime('now','-1 hour')), (?,?,?), (?,?,?) RETURNING id`,
          params: [ADDRESS, 'password', OLD, 'activitye2enull@test.example.com', 'password',
            'activitye2erecent@test.example.com', 'password', 'activitye2eunbound@test.example.com', 'password', OLD,
            'activitye2eother@test.example.com', 'password', OLD] },
        { sql: 'INSERT INTO raw_mails (address,raw) VALUES (?,?)',
          params: [ADDRESS, `From: sender@test.example.com\r\nTo: ${ADDRESS}\r\nSubject: activity fixture\r\n\r\nMail body`] },
        { sql: 'INSERT INTO sendbox (address,raw) VALUES (?,?)', params: [ADDRESS, '{"subject":"sent fixture"}'] },
        { sql: 'INSERT INTO auto_reply_mails (address,subject,message) VALUES (?,?,?)', params: [ADDRESS, 'reply', 'body'] },
        { sql: 'INSERT INTO address_sender (address,balance,enabled) VALUES (?,10,1)', params: [ADDRESS] },
      ]);
      userIds = result[0].results.map((row: { id: number }) => row.id);
      ids = [0, ...result[1].results.map((row: { id: number }) => row.id)];
      await batch(request, [{
        sql: 'INSERT INTO users_address (user_id,address_id) VALUES (?,?),(?,?),(?,?),(?,?)',
        params: [userIds[0], ids[1], userIds[0], ids[2], userIds[0], ids[3], userIds[1], ids[5]],
      }]);
    });

    test('bulk settings and JWT renewal only touch eligible addresses owned by the user', async ({ request }) => {
      await batch(request, [
        { sql: `WITH RECURSIVE numbers(value) AS (SELECT 10 UNION ALL SELECT value+1 FROM numbers WHERE value<109)
            INSERT INTO address (name,updated_at) SELECT 'activitye2ebulk'||value||'@test.example.com',? FROM numbers`, params: [OLD] },
        { sql: 'INSERT INTO users_address (user_id,address_id) SELECT ?,id FROM address WHERE name LIKE ?',
          params: [userIds[0], 'activitye2ebulk%'] },
      ]);
      const before = await rows(request, 'SELECT id,updated_at FROM address WHERE name LIKE ? ORDER BY id', [PREFIX]);
      const response = await call(request, '/user_api/settings', { headers: userAuth() });
      expectUpdates(response, disabled ? 0 : 1);
      const after = await rows(request, 'SELECT id,updated_at FROM address WHERE name LIKE ? ORDER BY id', [PREFIX]);
      for (let index = 0; index < before.length; index++) {
        if (disabled || [ids[3], ids[4], ids[5]].includes(before[index].id)) {
          expect(after[index]).toEqual(before[index]);
        } else {
          expect(after[index].updated_at).toBeTruthy();
          expect(after[index].updated_at).not.toBe(before[index].updated_at);
        }
      }
      const { new_user_token } = await response.json();
      expect(new_user_token).toBeTruthy();
      const renewed = await call(request, '/user_api/settings', { headers: { 'x-user-token': new_user_token } });
      expectUpdates(renewed, disabled ? 0 : 1);
      expect((await renewed.json()).new_user_token).toBeNull();
      expect(await rows(request, 'SELECT id,updated_at FROM address WHERE name LIKE ? ORDER BY id', [PREFIX])).toEqual(after);
    });

    for (const path of ['/api/settings', '/api/mails?limit=20&offset=0', '/api/parsed_mails?limit=20&offset=0']) {
      test(`${path} handles stale/null/recent timestamps and preserves daily throttling`, async ({ request }) => {
        const recent = await timestamp(request, ids[3]);
        for (const previous of [OLD, null, recent]) {
          await batch(request, [{ sql: 'UPDATE address SET updated_at=? WHERE id=?', params: [previous, ids[1]] }]);
          const response = await call(request, path, { headers: addressAuth() });
          expectUpdates(response, disabled ? 0 : 1);
          const updated = await timestamp(request);
          if (disabled || previous === recent) expect(updated).toBe(previous);
          else {
            expect(updated).toBeTruthy();
            expect(updated).not.toBe(previous);
          }
          await call(request, path, { headers: addressAuth() });
          expect(await timestamp(request)).toBe(updated);
          expect(await timestamp(request, ids[4])).toBe(OLD);
        }
      });
    }

    test('later inbox pages do not refresh activity', async ({ request }) => {
      for (const path of ['/api/mails?limit=20&offset=20', '/api/parsed_mails?limit=20&offset=20']) {
        expectUpdates(await call(request, path, { headers: addressAuth() }), 0);
        expect(await timestamp(request)).toBe(OLD);
      }
    });

    test('incoming mail is still stored without refreshing address activity', async ({ request }) => {
      const raw = `From: sender@test.example.com\r\nTo: ${ADDRESS}\r\nSubject: incoming activity mail\r\n\r\nMail body`;
      const response = await call(request, '/admin/test/receive_mail', {
        method: 'POST', data: { from: 'sender@test.example.com', to: ADDRESS, raw },
      });
      expect((await response.json()).success).toBe(true);
      expectUpdates(response, 0);
      expect((await rows(request, 'SELECT raw FROM raw_mails WHERE address=? ORDER BY id DESC', [ADDRESS]))[0].raw).toBe(raw);
      expect(await timestamp(request)).toBe(OLD);
    });

    test('address and user send APIs deliver mail while obeying the activity switch', async ({ request }) => {
      for (const [path, headers] of [
        ['/api/send_mail', addressAuth()],
        [`/user_api/address/${ids[1]}/send_mail`, userAuth()],
      ] as const) {
        await batch(request, [{ sql: 'UPDATE address SET updated_at=? WHERE id=?', params: [OLD, ids[1]] }]);
        const subject = `Activity ${label} ${path} ${Date.now()}`;
        const listener = onMailpitMessage(mail => mail.Subject === subject);
        await listener.ready;
        const response = await call(request, path, {
          method: 'POST', headers,
          data: { to_mail: 'recipient@test.example.com', subject, content: 'Activity E2E mail', is_html: false },
        });
        expectUpdates(response, disabled ? 0 : 1);
        const delivered = await listener.message;
        expect(delivered.From.Address).toBe(ADDRESS);
        expect((await timestamp(request)) === OLD).toBe(disabled);
      }
      expect((await rows(request, 'SELECT balance FROM address_sender WHERE address=?', [ADDRESS]))[0].balance).toBe(8);
      expect((await rows(request, 'SELECT count(*) AS count FROM sendbox WHERE address=?', [ADDRESS]))[0].count).toBe(3);
    });

    test('password generation, password changes and admin resets retain their timestamp updates', async ({ request }) => {
      const created = await call(request, '/api/new_address', {
        method: 'POST', data: { name: 'activitye2egenerated', domain: 'test.example.com' },
      });
      const address = await created.json();
      expectUpdates(created, disabled ? 1 : 2);
      expect(address.password).toBeTruthy();
      expect(await timestamp(request, address.address_id)).toBeTruthy();
      await call(request, '/api/address_login', {
        method: 'POST', data: { email: address.address, password: hashPassword(address.password) },
      });
      for (const path of ['/api/address_change_password', `/admin/address/${ids[1]}/reset_password`]) {
        await batch(request, [{ sql: 'UPDATE address SET updated_at=? WHERE id=?', params: [OLD, ids[1]] }]);
        const password = hashPassword(`password-${path}`);
        const response = await call(request, path, {
          method: 'POST', headers: addressAuth(), data: { password, new_password: password },
        });
        expectUpdates(response, 1);
        expect(await timestamp(request)).not.toBe(OLD);
        await call(request, '/api/address_login', { method: 'POST', data: { email: ADDRESS, password } });
      }
    });

    test('address transfer preserves initialization and obeys the activity switch', async ({ request }) => {
      const response = await call(request, '/user_api/transfer_address', {
        method: 'POST', headers: userAuth(), data: { address_id: ids[1], target_user_email: 'activitye2eother@test.example.com' },
      });
      expectUpdates(response, disabled ? 0 : 1);
      const [transferred] = await rows(request, `SELECT a.id,a.updated_at,ua.user_id FROM address a
        JOIN users_address ua ON ua.address_id=a.id WHERE a.name=?`, [ADDRESS]);
      expect(transferred.id).not.toBe(ids[1]);
      expect(transferred.user_id).toBe(userIds[1]);
      expect(transferred.updated_at).toBeTruthy();
      expect(transferred.updated_at).not.toBe(OLD);
    });

    test('manual inactivity cleanup protects addresses and all related data when disabled', async ({ request }) => {
      expect(await relatedCounts(request)).toEqual([1, 1, 1, 1, 1, 1]);
      for (const lang of ['en', 'zh'] as const) {
        const response = await call(request, '/admin/cleanup', {
          method: 'POST', headers: { 'x-lang': lang }, data: { cleanType: 'inactiveAddress', cleanDays: 1 },
        }, disabled ? 500 : 200);
        if (disabled) expect(await response.text()).toBe(FAILURE[lang]);
        else expect(await response.json()).toEqual({ success: true });
        expect(await relatedCounts(request)).toEqual(disabled ? [1, 1, 1, 1, 1, 1] : [0, 0, 0, 0, 0, 0]);
      }
      expect(await timestamp(request, ids[2])).toBeNull();
      expect(await timestamp(request, ids[3])).toBeTruthy();
    });

    test('scheduled inactivity cleanup respects the flag and continues later cleanup tasks', async ({ request }) => {
      await batch(request, [{ sql: 'UPDATE address SET created_at=? WHERE id=?', params: [OLD, ids[3]] }]);
      const [original] = await rows(request, "SELECT * FROM settings WHERE key='auto_cleanup'");
      try {
        await call(request, '/admin/auto_cleanup', {
          method: 'POST', data: {
            enableInactiveAddressAutoCleanup: true, cleanInactiveAddressDays: 1,
            enableAddressAutoCleanup: true, cleanAddressDays: 1,
          },
        });
        await call(request, '/__e2e/scheduled', { method: 'POST' });
        expect(await relatedCounts(request)).toEqual(disabled ? [1, 1, 1, 1, 1, 1] : [0, 0, 0, 0, 0, 0]);
        expect(await timestamp(request, ids[3])).toBeUndefined();
        expect(await timestamp(request, ids[2])).toBeNull();
      } finally {
        await batch(request, original ? [{
          sql: 'INSERT OR REPLACE INTO settings (key,value,created_at,updated_at) VALUES (?,?,?,?)',
          params: [original.key, original.value, original.created_at, original.updated_at],
        }] : [{ sql: "DELETE FROM settings WHERE key='auto_cleanup'" }]);
      }
    });

    for (const cleanType of ['addressCreated', 'unboundAddress', 'emptyAddress']) {
      test(`${cleanType} cleanup still removes eligible addresses`, async ({ request }) => {
        await batch(request, [{ sql: 'UPDATE address SET created_at=? WHERE id=?', params: [OLD, ids[4]] }]);
        await call(request, '/admin/cleanup', { method: 'POST', data: { cleanType, cleanDays: 1 } });
        expect(await timestamp(request, ids[4])).toBeUndefined();
        expect(await relatedCounts(request)).toEqual([1, 1, 1, 1, 1, 1]);
      });
    }

    for (const cleanType of ['mails', 'mails_unknow', 'sendbox']) {
      test(`${cleanType} cleanup still removes eligible mail`, async ({ request }) => {
        const table = cleanType === 'sendbox' ? 'sendbox' : 'raw_mails';
        await batch(request, [{
          sql: `INSERT INTO ${table} (address,raw,created_at) VALUES (?,?,?)`,
          params: ['activitye2eunknown@test.example.com', 'old mail', OLD],
        }]);
        await call(request, '/admin/cleanup', { method: 'POST', data: { cleanType, cleanDays: 1 } });
        expect(await rows(request, `SELECT id FROM ${table} WHERE address=?`, ['activitye2eunknown@test.example.com'])).toEqual([]);
        expect(await relatedCounts(request)).toEqual([1, 1, 1, 1, 1, 1]);
      });
    }

    test('cleanup validation and exception details keep their original behavior', async ({ request }) => {
      const invalid = await call(request, '/admin/cleanup', {
        method: 'POST', data: { cleanType: ' inactiveAddress', cleanDays: 1 },
      }, 500);
      expect(await invalid.text()).toContain('Invalid cleanType');
      const invalidDays = await call(request, '/admin/cleanup', {
        method: 'POST', data: { cleanType: 'mails', cleanDays: -1 },
      }, 500);
      expect(await invalidDays.text()).toContain('Invalid cleanType or cleanDays');
      await batch(request, [
        { sql: 'UPDATE raw_mails SET created_at=? WHERE address=?', params: [OLD, ADDRESS] },
        { sql: "CREATE TRIGGER fail_activity_cleanup BEFORE DELETE ON raw_mails WHEN OLD.address = 'activitye2eold@test.example.com' BEGIN SELECT RAISE(ABORT, 'e2e cleanup failure'); END" },
      ]);
      try {
        const failure = await call(request, '/admin/cleanup', {
          method: 'POST', data: { cleanType: 'mails', cleanDays: 1 },
        }, 500);
        expect(await failure.text()).toContain('Operation failed:');
        expect(await failure.text()).toContain('e2e cleanup failure');
      } finally {
        await batch(request, [{ sql: 'DROP TRIGGER fail_activity_cleanup' }]);
      }
    });
  });
}
