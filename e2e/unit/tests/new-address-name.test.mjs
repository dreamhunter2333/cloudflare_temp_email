import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { CONSTANTS } from '../../../worker/src/constants.ts';

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
  prepare: (sql) => ({
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
    async run() {
      const res = db.prepare(this.sql).run(...this.params);
      return { success: true, meta: { changes: res.changes } };
    },
  }),
});

const { default: _utilsDefault, ...utils } = await loadTsModule('../../../worker/src/utils.ts', { CONSTANTS });
const { getNameRegex } = await loadTsModule('../../../worker/src/utils/address_creation.ts', {
  ...utils,
  CONSTANTS,
  normalizeDomainValue: utils.trimLower,
});

const msgs = new Proxy({}, { get: (_t, key) => String(key) });

const { newAddress } = await loadTsModule('../../../worker/src/common.ts', {
  ...utils,
  CONSTANTS,
  i18n: { getMessagesbyContext: () => msgs },
  getNameRegex,
  checkNameBlockList: async () => {},
  checkNameRegex: () => {},
  shouldRejectExpiryInput: () => false,
  isAddressExpiryEnabled: () => false,
  normalizeAddressExpiresAt: (v) => v,
  getAddressCreationSubdomainMatchStatus: async () => ({ effectiveEnabled: false }),
  allowRandomSubdomainForDomain: () => false,
  findMatchedAllowedDomain: (domain, allowDomains) => (allowDomains.includes(domain) ? domain : null),
  generateRandomSubdomain: () => 'sub',
  createAddressToken: async (_c, address, id) => `jwt:${address}:${id}`,
  unbindTelegramByAddress: async () => true,
});

const createContext = (db, envOverrides = {}) => ({
  env: {
    DB: createD1Mock(db),
    DOMAINS: ['example.com'],
    DISABLE_ADDRESS_UPDATED_AT: true,
    ...envOverrides,
  },
  executionCtx: { waitUntil: () => {} },
  get: () => undefined,
});

const createDb = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE address (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    password TEXT,
    source_meta TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
};

for (const [name, expected] of [
  ['Alice', 'alice@example.com'],
  ['JohnSmith', 'johnsmith@example.com'],
  ['Bob4', 'bob4@example.com'],
  ['  MiXeD.Case-1 ', 'mixedcase1@example.com'],
  ['lower', 'lower@example.com'],
]) {
  test(`newAddress lowercases the requested name before filtering: ${JSON.stringify(name)}`, async (t) => {
    const db = createDb();
    t.after(() => db.close());
    const res = await newAddress(createContext(db), {
      name, domain: 'example.com', enablePrefix: false,
    });
    assert.equal(res.address, expected);
  });
}

test('newAddress still applies a custom ADDRESS_REGEX after lowercasing', async (t) => {
  const db = createDb();
  t.after(() => db.close());
  const res = await newAddress(createContext(db, { ADDRESS_REGEX: '[^a-z]' }), {
    name: 'Bob42', domain: 'example.com', enablePrefix: false,
  });
  assert.equal(res.address, 'bob@example.com');
});
