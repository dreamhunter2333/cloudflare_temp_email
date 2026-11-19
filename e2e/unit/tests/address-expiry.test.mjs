import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { CONSTANTS } from '../../../worker/src/constants.ts';
import { compareVersions } from '../../../worker/src/utils/version.ts';

const loadTsModule = async (relativePath, mocks = {}) => {
  const fileUrl = new URL(relativePath, import.meta.url);
  const raw = readFileSync(fileUrl, 'utf8');
  const strippedImports = raw.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  const js = stripTypeScriptTypes(strippedImports);
  const key = `__mock_${Math.random().toString(36).slice(2)}`;
  globalThis[key] = mocks;
  const mockDecl = Object.keys(mocks).length > 0
    ? `const { ${Object.keys(mocks).join(', ')} } = globalThis.${key};\n`
    : '';
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(`${mockDecl}${js}`).toString('base64')}`);
  } finally {
    delete globalThis[key];
  }
};

const createD1Mock = (db) => ({
  exec: async (sql) => {
    db.exec(sql);
  },
  prepare: (sql) => {
    const stmt = {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        return this;
      },
      async first(col) {
        const row = db.prepare(this.sql).get(...this.params);
        if (!row) return null;
        return col ? row[col] : row;
      },
      async all() {
        return { results: db.prepare(this.sql).all(...this.params), success: true };
      },
      async run() {
        const res = db.prepare(this.sql).run(...this.params);
        return { success: true, meta: { changes: res.changes, last_row_id: res.lastInsertRowid } };
      },
    };
    return stmt;
  },
  batch: async (stmts) => {
    const results = [];
    db.exec('BEGIN');
    try {
      for (const s of stmts) {
        if (/^\s*select\b/i.test(s.sql) || /\breturning\b/i.test(s.sql)) {
          results.push({ results: db.prepare(s.sql).all(...s.params), success: true });
        } else {
          const res = db.prepare(s.sql).run(...s.params);
          results.push({ results: [], success: true, meta: { changes: res.changes } });
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return results;
  },
});

const createContext = (db, { envOverrides = {}, query = {}, params = {}, jsonBody = {}, userId = 1 } = {}) => ({
  env: {
    DB: createD1Mock(db),
    ENABLE_USER_DELETE_EMAIL: 'true',
    DEFAULT_LANG: 'en',
    ...envOverrides,
  },
  req: {
    query: () => query,
    param: (name) => (name ? params[name] : params),
    json: async () => jsonBody,
  },
  get: (key) => (key === 'userPayload' ? { user_id: userId } : undefined),
  json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  text: (body, status = 200) => new Response(body, { status }),
});

const createTestMessages = () => ({
  InvalidCleanupConfigMsg: 'Invalid cleanType or cleanDays',
  InvalidCleanTypeMsg: 'Invalid cleanType',
  InvalidExpiresAtMsg: 'Invalid expiresAt',
  AddressExpiryDisabledMsg: 'Address expiration is disabled',
  FailedCreateAddressMsg: 'Failed to create address',
  AddressNotFoundMsg: 'Address not found',
  AddressNotBindedMsg: 'Address not binded',
  UserDeleteEmailDisabledMsg: 'User delete disabled',
  OperationFailedMsg: 'Operation failed',
  UserNotFoundMsg: 'User not found',
  TargetUserNotFoundMsg: 'Target user not found',
  MaxAddressCountReachedMsg: 'Max address count reached',
  AddressAlreadyBindedMsg: 'Address already binded',
  NoAddressOrUserTokenMsg: 'Missing address or user token',
  InvalidAddressOrUserTokenMsg: 'Invalid address or user token',
});

const loadCommonModule = async ({ unbindTelegramByAddress = async () => true, getJsonSetting = async () => null } = {}) => {
  const msgs = createTestMessages();
  return loadTsModule('../../../worker/src/common.ts', {
    CONSTANTS,
    isAddressExpiryEnabled,
    normalizeAddressExpiresAt,
    shouldRejectExpiryInput,
    i18n: { getMessagesbyContext: () => msgs },
    unbindTelegramByAddress,
    createAddressToken: async (_c, addr, id) => `jwt:${addr}:${id}`,
    getBooleanValue: (v) => v === true || v === 'true',
    getIntValue: (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def),
    getDomains: () => ['example.com'],
    getStringArray: () => [],
    getStringValue: (v) => String(v || ''),
    getUserRoles: async () => null,
    getDefaultDomains: () => ['example.com'],
    getJsonSetting,
    getAnotherWorkerList: () => [],
    hashPassword: async (p) => p,
    getJsonObjectValue: () => null,
    getRandomSubdomainDomains: () => [],
    getDomainMapValue: () => null,
    isDomainOrSubdomain: () => false,
    normalizeDomains: (d) => d,
    trimLower: (s) => (s || '').trim().toLowerCase(),
    formatWebhookBody: () => '',
    getWebhookAttachments: async () => [],
    compileFilter: () => () => true,
  });
};

const { getBooleanValue } = await loadTsModule('../../../worker/src/utils.ts', { CONSTANTS });
const { isAddressExpiryEnabled, isAddressExpired, normalizeAddressExpiresAt, shouldRejectExpiryInput } =
  await loadTsModule('../../../worker/src/utils/address_expiry.ts', { getBooleanValue });

const disabledContext = { env: { ENABLE_ADDRESS_EXPIRY: false } };
const enabledContext = { env: { ENABLE_ADDRESS_EXPIRY: true } };

const messages = { InvalidExpiresAtMsg: 'Invalid expiry' };

test('reading an unmigrated SQLite row needs no expiry-column fallback', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec("CREATE TABLE address (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO address VALUES (1, 'legacy@example.com')");
  const row = db.prepare('SELECT * FROM address WHERE id = ?').get(1);
  assert.equal(row.name, 'legacy@example.com');
  assert.equal(row.expires_at, undefined);
  assert.equal(isAddressExpired(disabledContext, row.expires_at), false);
  assert.equal(isAddressExpired(enabledContext, row.expires_at), false);
});

test('expiry checks retain permanent, expired, future and invalid-date behavior', () => {
  for (const value of [undefined, null, '', 'not-a-date', '2099-01-01 00:00:00', '2099-01-01T00:00:00Z']) {
    assert.equal(isAddressExpired(enabledContext, value), false, String(value));
  }
  for (const value of ['2020-01-01 00:00:00', '2020-01-01T08:00:00+08:00']) {
    assert.equal(isAddressExpired(enabledContext, value), true, value);
  }
});

test('expiry input is rejected only when the feature is disabled', () => {
  for (const value of [undefined, null]) {
    assert.equal(shouldRejectExpiryInput(disabledContext, value), false);
    assert.equal(shouldRejectExpiryInput(enabledContext, value), false);
  }
  for (const value of ['', 0, '2099-01-01T00:00:00Z']) {
    assert.equal(shouldRejectExpiryInput(disabledContext, value), true);
    assert.equal(shouldRejectExpiryInput(enabledContext, value), false);
  }
});

test('disabled expiry skips enforcement for expired addresses', () => {
  for (const flag of [undefined, false, 'false']) {
    const context = { env: { ENABLE_ADDRESS_EXPIRY: flag } };
    assert.equal(isAddressExpired(context, '2020-01-01 00:00:00'), false);
  }
  for (const flag of [true, 'true']) {
    const context = { env: { ENABLE_ADDRESS_EXPIRY: flag } };
    assert.equal(isAddressExpired(context, '2020-01-01 00:00:00'), true);
  }
});

test('absolute expiry formats normalize to the same UTC database timestamp', () => {
  for (const value of [
    '2099-01-01 00:00:00', '2099-01-01T00:00Z', '2099-01-01T00:00:00.123Z',
    '2099-01-01T08:00:00+08:00', '2099-01-01T08:00:00+0800',
    Date.parse('2099-01-01T00:00:00Z'),
  ]) {
    assert.equal(normalizeAddressExpiresAt(value, messages), '2099-01-01 00:00:00');
  }
  assert.equal(normalizeAddressExpiresAt('2096-02-29T00:00:00Z', messages), '2096-02-29 00:00:00');
  assert.equal(normalizeAddressExpiresAt('+002096-02-29T00:00:00Z', messages), '2096-02-29 00:00:00');
  assert.equal(normalizeAddressExpiresAt('2099-12-31T23:59:59Z', messages), '2099-12-31 23:59:59');
});

for (const value of [
  '2019-01-01T00:00:00Z', '2100-01-01T00:00:00Z', '2999-01-01T00:00:00Z',
  Date.parse('2999-01-01T00:00:00Z'), '', 'not-a-date', '2099-02-29T00:00:00Z', '2099-13-01T00:00:00Z',
  '+002099-02-30T00:00:00Z', '2099-01-01T08:00:00', '2099-01-01',
  'February 30, 2099 00:00:00 GMT', '2099-02-30 00:00:00',
  Number.NaN, Infinity, true, null, undefined,
]) {
  test(`rejects invalid expiry input: ${String(value)}`, () => {
    assert.throws(() => normalizeAddressExpiresAt(value, messages), /Invalid expiry/);
  });
}

test('DB initialization and v0.0.10 -> v0.0.11 migration add expires_at column and index', async (t) => {
  const settingsMap = new Map();
  const utilsMock = {
    getSetting: async (_c, key) => settingsMap.get(key) ?? null,
    saveSetting: async (_c, key, value) => { settingsMap.set(key, value); },
  };
  const dbApi = (await loadTsModule('../../../worker/src/admin_api/db_api.ts', {
    CONSTANTS,
    utils: utilsMock,
    compareVersions,
  })).default;

  // 1. Fresh initialization via DB_INIT_QUERIES
  const freshDb = new DatabaseSync(':memory:');
  t.after(() => freshDb.close());
  const freshContext = createContext(freshDb);
  freshContext.env.DB.prepare = () => assert.fail('Fresh initialization must not run migration checks');
  const initRes = await dbApi.initialize(freshContext);
  assert.equal(initRes.status, 200);
  assert.equal(settingsMap.get(CONSTANTS.DB_VERSION_KEY), 'v0.0.11');
  const freshCols = freshDb.prepare('PRAGMA table_info(address)').all().map((r) => r.name);
  assert.ok(freshCols.includes('expires_at'));
  const freshIndexes = freshDb.prepare('PRAGMA index_list(address)').all().map((r) => r.name);
  assert.ok(freshIndexes.includes('idx_address_expires_at'));

  // 2. Migration from v0.0.10 schema without expires_at
  const legacyDb = new DatabaseSync(':memory:');
  t.after(() => legacyDb.close());
  legacyDb.exec(`
    CREATE TABLE address (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      password TEXT,
      source_meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE raw_mails (id INTEGER PRIMARY KEY, message_id TEXT, source TEXT, address TEXT, raw TEXT, raw_blob BLOB, metadata TEXT, is_unread INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE auto_reply_mails (id INTEGER PRIMARY KEY, source_prefix TEXT, name TEXT, address TEXT UNIQUE, subject TEXT, message TEXT, enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE address_sender (id INTEGER PRIMARY KEY, address TEXT UNIQUE, balance INTEGER DEFAULT 0, enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE sendbox (id INTEGER PRIMARY KEY, address TEXT, raw TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE users (id INTEGER PRIMARY KEY, user_email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, user_info TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE users_address (id INTEGER PRIMARY KEY, user_id INTEGER, address_id INTEGER UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE user_roles (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL, role_text TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE user_passkeys (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, passkey_name TEXT NOT NULL, passkey_id TEXT NOT NULL, passkey TEXT NOT NULL, counter INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE redeem_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, redeem_type TEXT NOT NULL, value TEXT NOT NULL, result TEXT, enabled INTEGER NOT NULL DEFAULT 1, redeemed INTEGER NOT NULL DEFAULT 0, expires_at DATETIME NOT NULL, redeemed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  settingsMap.set(CONSTANTS.DB_VERSION_KEY, 'v0.0.10');
  const migrateRes = await dbApi.migrate(createContext(legacyDb));
  assert.equal(migrateRes.status, 200);
  assert.equal(settingsMap.get(CONSTANTS.DB_VERSION_KEY), 'v0.0.11');
  const migratedCols = legacyDb.prepare('PRAGMA table_info(address)').all().map((r) => r.name);
  assert.ok(migratedCols.includes('expires_at'));
  const migratedIndexes = legacyDb.prepare('PRAGMA index_list(address)').all().map((r) => r.name);
  assert.ok(migratedIndexes.includes('idx_address_expires_at'));

  // 3. Migration from unversioned legacy schema (no db_version row, address table lacks expires_at)
  const unversionedDb = new DatabaseSync(':memory:');
  t.after(() => unversionedDb.close());
  unversionedDb.exec(`
    CREATE TABLE address (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      password TEXT,
      source_meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  settingsMap.delete(CONSTANTS.DB_VERSION_KEY);
  const unversionedRes = await dbApi.migrate(createContext(unversionedDb));
  assert.equal(unversionedRes.status, 200);
  assert.equal(settingsMap.get(CONSTANTS.DB_VERSION_KEY), 'v0.0.11');
  const unversionedCols = unversionedDb.prepare('PRAGMA table_info(address)').all().map((r) => r.name);
  assert.ok(unversionedCols.includes('expires_at'));
  const unversionedIndexes = unversionedDb.prepare('PRAGMA index_list(address)').all().map((r) => r.name);
  assert.ok(unversionedIndexes.includes('idx_address_expires_at'));
});

test('shared-auth, single-address user APIs, and transferAddress respect ENABLE_ADDRESS_EXPIRY', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../../../db/schema.sql', import.meta.url), 'utf8'));

  const common = await loadCommonModule();
  const msgs = createTestMessages();
  const bindAddressMod = await loadTsModule('../../../worker/src/user_api/bind_address.ts', {
    createAddressToken: async (_c, addr, id) => `jwt:${addr}:${id}`,
    isAddressCountLimitReached: async () => false,
    unbindTelegramByAddress: async () => true,
    i18n: { getMessagesbyContext: () => msgs },
    updateAddressUpdatedAt: async () => {},
    commonGetUserRole: async () => null,
    handleListQuery: common.handleListQuery,
    hideObjectFields: common.hideObjectFields,
    isAddressExpired,
  });
  const sentCalls = [];
  const userSendMailApi = (await loadTsModule('../../../worker/src/user_api/user_send_mail_api.ts', {
    handleListQuery: async (c, query, countQuery, params) => {
      const results = db.prepare(`${query} ORDER BY sb.id desc`).all(...params);
      const countRow = db.prepare(countQuery).get(...params);
      return c.json({ results, count: countRow.count });
    },
    i18n: { getMessagesbyContext: () => msgs },
    sendMail: async (_c, address, body) => { sentCalls.push({ address, body }); },
    getSendBalanceState: async () => ({ balance: 5 }),
    requestSendMailAccess: async () => ({ status: 'ok' }),
    getBooleanValue: (v) => v === true || v === 'true',
    getBindedAddressById: bindAddressMod.getBindedAddressById,
  })).default;

  const addressAuthMod = await loadTsModule('../../../worker/src/address_auth.ts', {
    jwt: () => async () => {},
    Jwt: { sign: async () => '', verify: async () => ({}) },
    i18n: { getMessagesbyContext: () => msgs },
    getBooleanValue: (v) => v === true || v === 'true',
    isAddressExpired,
  });

  db.prepare(`INSERT INTO users(id, user_email, password) VALUES (1, 'u1@example.com', 'p'), (2, 'u2@example.com', 'p')`).run();
  db.prepare(`INSERT INTO address(id, name, expires_at) VALUES (1, 'expired@example.com', '2020-01-01 00:00:00')`).run();
  db.prepare(`INSERT INTO address(id, name, expires_at) VALUES (2, 'active@example.com', '2099-01-01 00:00:00')`).run();
  db.prepare(`INSERT INTO address(id, name, expires_at) VALUES (3, 'forever@example.com', NULL)`).run();
  db.prepare(`INSERT INTO address(id, name, expires_at) VALUES (4, 'unbound-exp@example.com', '2020-01-01 00:00:00')`).run();
  db.prepare(`INSERT INTO users_address(user_id, address_id) VALUES (1, 1), (1, 2), (1, 3)`).run();

  // Disabled flag skips expiry enforcement cleanly
  assert.equal(await bindAddressMod.getBindedAddressById(createContext(db), 1, 1), 'expired@example.com');
  assert.deepEqual(
    await addressAuthMod.validateAddressPayload(createContext(db), { address: 'expired@example.com', address_id: 1 }),
    { address: 'expired@example.com', address_id: 1 },
  );

  const enabledEnv = { envOverrides: { ENABLE_ADDRESS_EXPIRY: 'true' } };

  // Enabled flag: validateAddressPayload and getBindedAddressById reject expired, keep active & never-expiring
  assert.equal(
    await addressAuthMod.validateAddressPayload(createContext(db, enabledEnv), { address: 'expired@example.com', address_id: 1 }),
    null,
  );
  assert.deepEqual(
    await addressAuthMod.validateAddressPayload(createContext(db, enabledEnv), { address: 'active@example.com', address_id: 2 }),
    { address: 'active@example.com', address_id: 2 },
  );
  assert.equal(
    await addressAuthMod.validateAddressPayload(createContext(db, enabledEnv), { address: 'other@example.com', address_id: 2 }),
    null,
  );
  assert.deepEqual(
    await addressAuthMod.validateAddressPayload(createContext(db, enabledEnv), { address: 'forever@example.com', address_id: 3 }),
    { address: 'forever@example.com', address_id: 3 },
  );
  assert.equal(await bindAddressMod.getBindedAddressById(createContext(db, enabledEnv), 1, 1), null);
  assert.equal(await bindAddressMod.getBindedAddressById(createContext(db, enabledEnv), 1, 2), 'active@example.com');
  assert.equal(await bindAddressMod.getBindedAddressById(createContext(db, enabledEnv), 1, 3), 'forever@example.com');

  // bindByID rejects already-expired address when enabled
  const bindExpiredRes = await bindAddressMod.default.bindByID(createContext(db, enabledEnv), 1, 4);
  assert.equal(bindExpiredRes.status, 400);

  // Single-address send endpoint enforces via getBindedAddressById
  const expiredSendRes = await userSendMailApi.send(createContext(db, { ...enabledEnv, params: { address_id: '1' }, jsonBody: { subject: 'hi' } }));
  assert.equal(expiredSendRes.status, 400);
  assert.equal(sentCalls.length, 0);

  const activeSendRes = await userSendMailApi.send(createContext(db, { ...enabledEnv, params: { address_id: '2' }, jsonBody: { subject: 'hi' } }));
  assert.equal(activeSendRes.status, 200);
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].address, 'active@example.com');

  // transferAddress rejects expired address and inherits expires_at for active address
  const transferExpired = await bindAddressMod.default.transferAddress(
    createContext(db, { ...enabledEnv, jsonBody: { address_id: 1, target_user_email: 'u2@example.com' } })
  );
  assert.equal(transferExpired.status, 400);

  const transferActive = await bindAddressMod.default.transferAddress(
    createContext(db, { ...enabledEnv, jsonBody: { address_id: 2, target_user_email: 'u2@example.com' } })
  );
  assert.equal(transferActive.status, 200);
  const transferred = db.prepare(`SELECT id, expires_at FROM address WHERE name = 'active@example.com'`).get();
  assert.ok(transferred.id > 2);
  assert.equal(transferred.expires_at, '2099-01-01 00:00:00');
  const ownerRow = db.prepare(`SELECT user_id FROM users_address WHERE address_id = ?`).get(transferred.id);
  assert.equal(ownerRow?.user_id, 2);
});

test('expiredAddress cleanup unbinds >10 Telegram addresses, retries failures, and respects KV budget', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../../../db/schema.sql', import.meta.url), 'utf8'));

  // Disabled flag rejects manual expiredAddress cleanup with AddressExpiryDisabledMsg
  const commonDisabled = await loadCommonModule();
  await assert.rejects(
    () => commonDisabled.cleanup(createContext(db), 'expiredAddress', 0),
    /AddressExpiryDisabled|disabled/i
  );

  for (let i = 1; i <= 11; i++) {
    db.prepare(`INSERT INTO address(name, expires_at) VALUES (?, '2020-01-01 00:00:00')`).run(`exp${i}@example.com`);
  }
  db.prepare(`INSERT INTO address(name, expires_at) VALUES ('future@example.com', '2099-01-01 00:00:00'), ('perm@example.com', NULL)`).run();

  const unbound = [];
  let failOnceFor = 'exp5@example.com';
  const common = await loadCommonModule({
    unbindTelegramByAddress: async (_c, address) => {
      if (address === failOnceFor) {
        failOnceFor = null;
        throw new Error('KV transient error');
      }
      unbound.push(address);
      return true;
    },
  });

  const ctx = createContext(db, { envOverrides: { ENABLE_ADDRESS_EXPIRY: 'true' } });
  await assert.rejects(() => common.cleanup(ctx, 'expiredAddress', 0), /KV transient error/);

  // 10 succeeded addresses were unbound and deleted; exp5@example.com stays in D1 for retry
  assert.equal(unbound.length, 10);
  const remainingExpired = db.prepare(`SELECT name FROM address WHERE expires_at = '2020-01-01 00:00:00'`).all();
  assert.deepEqual(remainingExpired.map((r) => r.name), ['exp5@example.com']);

  // Retry succeeds and deletes the 11th address while leaving future & permanent addresses intact
  await common.cleanup(ctx, 'expiredAddress', 0);
  assert.equal(unbound.length, 11);
  assert.ok(unbound.includes('exp5@example.com'));
  const remaining = db.prepare(`SELECT name FROM address ORDER BY id`).all().map((r) => r.name);
  assert.deepEqual(remaining, ['future@example.com', 'perm@example.com']);

  // Platform KV-budget boundary simulation with default CLEANUP_BATCH_SIZE=3000 and >50 expired rows
  for (let i = 1; i <= 65; i++) {
    db.prepare(`INSERT INTO address(name, expires_at) VALUES (?, '2020-01-01 00:00:00')`).run(`bulk${i}@example.com`);
  }
  let kvOpCount = 0;
  const mockKvStore = new Map([
    ['temp-mail-telegram:bulk1@example.com', '99'],
    ['temp-mail-telegram:99', JSON.stringify(['jwt-bulk1'])],
  ]);
  const budgetKv = {
    async get(key, type) {
      kvOpCount += 1;
      const val = mockKvStore.get(key) ?? null;
      return type === 'json' && val ? JSON.parse(val) : val;
    },
    async put(key, value) {
      kvOpCount += 1;
      mockKvStore.set(key, value);
    },
    async delete(key) {
      kvOpCount += 1;
      mockKvStore.delete(key);
    },
  };
  const budgetCommon = await loadCommonModule({
    unbindTelegramByAddress: async (innerCtx, address) => {
      const uid = await innerCtx.env.KV.get(`temp-mail-telegram:${address}`);
      if (uid) {
        await innerCtx.env.KV.get(`temp-mail-telegram:${uid}`, 'json');
        await innerCtx.env.KV.put(`temp-mail-telegram:${uid}`, '[]');
        await innerCtx.env.KV.get(`temp-mail-telegram:${address}`);
        await innerCtx.env.KV.delete(`temp-mail-telegram:${address}`);
      }
      return true;
    },
  });
  const budgetCtx = createContext(db, {
    envOverrides: {
      ENABLE_ADDRESS_EXPIRY: 'true',
      KV: budgetKv,
    },
  });

  // First run caps KV operations under Free-tier subrequest headroom and still commits deletions
  await budgetCommon.cleanup(budgetCtx, 'expiredAddress', 0);
  assert.ok(kvOpCount > 0 && kvOpCount <= 45, `Expected bounded KV ops <= 45, got ${kvOpCount}`);
  assert.equal(mockKvStore.has('temp-mail-telegram:bulk1@example.com'), false);
  const afterRun1 = db.prepare(`SELECT count(*) as c FROM address WHERE expires_at = '2020-01-01 00:00:00'`).get().c;
  assert.ok(afterRun1 > 0 && afterRun1 < 65, `Expected partial chunk deletion on run 1, remaining=${afterRun1}`);

  // Subsequent runs drain remaining expired addresses cleanly
  await budgetCommon.cleanup(budgetCtx, 'expiredAddress', 0);
  await budgetCommon.cleanup(budgetCtx, 'expiredAddress', 0);
  const afterAllRuns = db.prepare(`SELECT count(*) as c FROM address WHERE expires_at = '2020-01-01 00:00:00'`).get().c;
  assert.equal(afterAllRuns, 0);
  assert.deepEqual(
    db.prepare(`SELECT name FROM address ORDER BY id`).all().map((r) => r.name),
    ['future@example.com', 'perm@example.com'],
  );
});
