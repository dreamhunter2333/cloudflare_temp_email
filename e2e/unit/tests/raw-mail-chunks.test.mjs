import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
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

// D1 binds ArrayBuffer as BLOB and returns BLOB as Array<number>
const toSqlite = (value) => (value instanceof ArrayBuffer ? new Uint8Array(value) : value);
const fromSqlite = (row) => Object.fromEntries(Object.entries(row).map(
  ([key, value]) => [key, value instanceof Uint8Array ? Array.from(value) : value],
));

const createD1Mock = (db) => {
  const prepare = (sql) => ({
    sql,
    params: [],
    bind(...params) {
      this.params = params.map(toSqlite);
      return this;
    },
    async first(col) {
      const row = db.prepare(this.sql).get(...this.params);
      if (!row) return null;
      return col ? row[col] : fromSqlite(row);
    },
    async all() {
      return { results: db.prepare(this.sql).all(...this.params).map(fromSqlite), success: true };
    },
    async run() {
      const res = db.prepare(this.sql).run(...this.params);
      return { success: true, meta: { changes: res.changes, last_row_id: Number(res.lastInsertRowid) } };
    },
  });
  return {
    exec: async (sql) => db.exec(sql),
    prepare,
    // D1 runs a batch as one transaction and rolls it back if any statement fails
    batch: async (stmts) => {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of stmts) results.push(/^\s*select\b/i.test(stmt.sql) ? await stmt.all() : await stmt.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
};

const { getBooleanValue } = await loadTsModule('../../../worker/src/utils.ts', { CONSTANTS });
const gzip = await loadTsModule('../../../worker/src/gzip.ts');
const loadStorage = () => loadTsModule('../../../worker/src/email/storage.ts', {
  compressText: gzip.compressText,
  getBooleanValue,
  createMimeMessage: () => assert.fail('not used'),
});

const dbApi = (await loadTsModule('../../../worker/src/admin_api/db_api.ts', {
  CONSTANTS,
  compareVersions,
  utils: { getSetting: async () => null, saveSetting: async () => {} },
})).default;

// Create the schema the way the Worker does, or from the given SQL
const createDb = async (t, schema) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  if (schema) db.exec(schema);
  else await dbApi.initialize({ env: { DB: createD1Mock(db) }, json: (body) => Response.json(body) });
  return db;
};

const HEADER = 'From: sender@test\r\nTo: user@test\r\nSubject: large\r\n\r\n';
// A mail of exactly `bytes` UTF-8 bytes
const mailOfSize = (bytes, filler = 'a') => {
  const count = Math.floor((bytes - HEADER.length) / Buffer.byteLength(filler));
  return HEADER + filler.repeat(count) + 'a'.repeat(bytes - HEADER.length - count * Buffer.byteLength(filler));
};

const chunkRows = (db, mailId) => db.prepare(
  `SELECT c.seq, c.data FROM raw_mail_chunks c JOIN raw_mails m ON m.raw_chunk_key = c.chunk_key
   WHERE m.id = ? ORDER BY c.seq`,
).all(mailId);

const storeAndRead = async (t, raw, envOverrides = {}) => {
  const db = await createDb(t);
  const env = { DB: createD1Mock(db), ...envOverrides };
  const storage = await loadStorage();
  const { success, meta } = await storage.storeRawMail(env, 'sender@test', 'user@test', '<id@test>', raw);
  assert.equal(success, true);
  const row = await env.DB.prepare('SELECT * FROM raw_mails WHERE id = ?').bind(meta.last_row_id).first();
  return { db, env, storage, row, id: meta.last_row_id, resolved: await gzip.resolveRawEmail(env.DB, row) };
};

test('database foreign keys are enforced, as on D1', async (t) => {
  assert.equal((await createDb(t)).prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});

test('splitRawMail keeps characters whole and each chunk within the byte limit', async () => {
  const { splitRawMail } = await loadStorage();
  const text = 'ab中文😀'.repeat(1000) + '中';
  for (const maxBytes of [4, 5, 7, 1000]) {
    const chunks = splitRawMail(text, maxBytes);
    assert.equal(chunks.join(''), text);
    for (const [index, chunk] of chunks.entries()) {
      assert.ok(Buffer.byteLength(chunk) <= maxBytes);
      if (index < chunks.length - 1) {
        assert.ok(Buffer.byteLength(chunk) > maxBytes - 4, 'chunks are filled up to the limit');
      }
    }
  }
  const bytes = randomBytes(2500).buffer;
  const parts = splitRawMail(bytes, 1000);
  assert.deepEqual(parts.map((part) => part.byteLength), [1000, 1000, 500]);
  assert.deepEqual(Buffer.concat(parts.map((part) => Buffer.from(part))), Buffer.from(bytes));
});

test('mail up to the chunk size stays in one row; one byte more is chunked', async (t) => {
  const { RAW_MAIL_CHUNK_BYTES } = await loadStorage();
  const atLimit = mailOfSize(RAW_MAIL_CHUNK_BYTES);
  const inline = await storeAndRead(t, atLimit);
  assert.equal(inline.row.raw, atLimit);
  assert.equal(inline.row.raw_chunk_key, null);
  assert.equal(inline.db.prepare('SELECT COUNT(*) AS n FROM raw_mail_chunks').get().n, 0);

  const overLimit = mailOfSize(RAW_MAIL_CHUNK_BYTES + 1);
  const chunked = await storeAndRead(t, overLimit);
  assert.equal(chunked.row.raw, null);
  assert.equal(chunked.row.raw_blob, null);
  assert.match(chunked.row.raw_chunk_key, /^[0-9a-f-]{36}$/);
  assert.deepEqual(chunkRows(chunked.db, chunked.id).map((row) => Buffer.byteLength(row.data)),
    [RAW_MAIL_CHUNK_BYTES, 1]);
  assert.equal(chunked.resolved, overLimit);
});

test('large Chinese plaintext mail is stored in text chunks and read back unchanged', async (t) => {
  const { RAW_MAIL_CHUNK_BYTES } = await loadStorage();
  const raw = mailOfSize(2_130_000, '繁體中文郵件內容，');
  const { db, row, id, resolved } = await storeAndRead(t, raw, { ENABLE_MAIL_READ_STATUS: 'true' });
  const chunks = chunkRows(db, id);
  assert.equal(chunks.length, 3);
  for (const chunk of chunks) {
    assert.equal(typeof chunk.data, 'string');
    assert.ok(Buffer.byteLength(chunk.data) <= RAW_MAIL_CHUNK_BYTES);
  }
  assert.equal(row.is_unread, 1);
  assert.equal(resolved, raw);
});

test('gzip: compressible large mail stays in raw_blob; incompressible mail is chunked as BLOB', async (t) => {
  const compressible = mailOfSize(3_200_000, 'repeat ');
  const small = await storeAndRead(t, compressible, { ENABLE_MAIL_GZIP: 'true' });
  assert.equal(small.row.raw_chunk_key, null);
  assert.ok(small.row.raw_blob.length < 1_000_000);
  assert.equal(small.resolved, compressible);

  const incompressible = HEADER + randomBytes(2_400_000).toString('base64');
  const large = await storeAndRead(t, incompressible, { ENABLE_MAIL_GZIP: 'true' });
  assert.equal(large.row.raw_blob, null);
  const chunks = chunkRows(large.db, large.id);
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((chunk) => chunk.data instanceof Uint8Array));
  assert.equal(large.resolved, incompressible);
});

test('a failure while writing chunks stores neither the mail nor any chunk', async (t) => {
  const db = await createDb(t);
  db.exec(`CREATE TRIGGER fail_second_chunk BEFORE INSERT ON raw_mail_chunks WHEN NEW.seq = 1
    BEGIN SELECT RAISE(ABORT, 'chunk write failed'); END`);
  const storage = await loadStorage();
  await assert.rejects(
    storage.storeRawMail({ DB: createD1Mock(db) }, 'sender@test', 'user@test', null, mailOfSize(2_500_000)),
    /chunk write failed/,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM raw_mails').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM raw_mail_chunks').get().n, 0);
});

test('every way of deleting mail also deletes its chunks', async (t) => {
  const db = await createDb(t);
  const env = { DB: createD1Mock(db) };
  const storage = await loadStorage();
  const store = async (address) => (await storage.storeRawMail(
    env, 'sender@test', address, null, mailOfSize(2_100_000))).meta.last_row_id;
  const chunkCount = () => db.prepare('SELECT COUNT(*) AS n FROM raw_mail_chunks').get().n;

  const kept = await store('keep@test');
  const single = await store('a@test');
  await storage.deleteRawMail(env, single, 'a@test');
  assert.equal(chunkCount(), 3);

  await store('b@test');
  await store('b@test');
  db.prepare('DELETE FROM raw_mails WHERE address = ?').run('b@test');
  assert.equal(chunkCount(), 3);

  await store('c@test');
  db.exec("UPDATE raw_mails SET created_at = datetime('now', '-30 days') WHERE address = 'c@test'");
  db.prepare("DELETE FROM raw_mails WHERE created_at < datetime('now', '-7 days')").run();
  assert.equal(chunkCount(), 3);

  assert.equal(chunkRows(db, kept).length, 3);
  db.exec('DELETE FROM raw_mails');
  assert.equal(chunkCount(), 0);
});

test('mail lists read inline, gzip and chunked rows and hide storage columns', async (t) => {
  const db = await createDb(t);
  const storage = await loadStorage();
  const plainEnv = { DB: createD1Mock(db) };
  const gzipEnv = { DB: createD1Mock(db), ENABLE_MAIL_GZIP: 'true' };
  const mails = [
    [plainEnv, 'From: a\r\n\r\nsmall plain'],
    [gzipEnv, 'From: b\r\n\r\nsmall gzip'],
    [plainEnv, mailOfSize(1_500_000, '中')],
    [gzipEnv, HEADER + randomBytes(1_200_000).toString('base64')],
  ];
  for (const [env, raw] of mails) await storage.storeRawMail(env, 'sender@test', 'user@test', null, raw);
  const { results } = await plainEnv.DB.prepare('SELECT * FROM raw_mails ORDER BY id').all();
  const resolved = await gzip.resolveRawEmailList(plainEnv.DB, results);
  assert.deepEqual(resolved.map((row) => row.raw), mails.map(([, raw]) => raw));
  for (const row of resolved) {
    assert.equal('raw_blob' in row, false);
    assert.equal('raw_chunk_key' in row, false);
  }
});

test('a mail with a missing chunk reads as empty instead of failing the request', async (t) => {
  const { db, env, id } = await storeAndRead(t, mailOfSize(2_100_000));
  db.prepare('DELETE FROM raw_mail_chunks WHERE seq = 1').run();
  const row = await env.DB.prepare('SELECT * FROM raw_mails WHERE id = ?').bind(id).first();
  const errors = t.mock.method(console, 'error', () => {});
  assert.equal(await gzip.resolveRawEmail(env.DB, row), '');
  assert.equal(errors.mock.callCount(), 1);
});

test('chunked writes wait until the chunk table exists, not just the column', async (t) => {
  // The migration adds raw_chunk_key before it creates raw_mail_chunks
  const db = await createDb(t, `CREATE TABLE raw_mails (id INTEGER PRIMARY KEY, message_id TEXT, source TEXT,
    address TEXT, raw TEXT, raw_blob BLOB, raw_chunk_key TEXT, metadata TEXT, is_unread INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  const storage = await loadStorage();
  const raw = mailOfSize(1_500_000);
  await storage.storeRawMail({ DB: createD1Mock(db) }, 'sender@test', 'user@test', null, raw);
  assert.deepEqual({ ...db.prepare('SELECT raw, raw_chunk_key FROM raw_mails').get() }, { raw, raw_chunk_key: null });
});

test('a list reads the chunks of ten mails per batch, never one query per mail', async (t) => {
  const db = await createDb(t);
  const storage = await loadStorage();
  const mock = createD1Mock(db);
  for (let i = 0; i < 25; i++) {
    await storage.storeRawMail({ DB: mock }, 'sender@test', 'user@test', null, mailOfSize(1_000_100 + i));
  }
  await storage.storeRawMail({ DB: mock }, 'sender@test', 'user@test', null, 'From: a\r\n\r\nsmall');
  const { results } = await mock.prepare('SELECT * FROM raw_mails ORDER BY id').all();
  // Count batches, and queries run on their own rather than inside a batch
  const calls = { batch: 0, query: 0 };
  let inBatch = false;
  const counting = {
    ...mock,
    prepare: (sql) => {
      const stmt = mock.prepare(sql);
      const all = stmt.all.bind(stmt);
      stmt.all = async () => { if (!inBatch) calls.query++; return all(); };
      return stmt;
    },
    batch: async (stmts) => {
      calls.batch++;
      inBatch = true;
      try { return await mock.batch(stmts); } finally { inBatch = false; }
    },
  };
  const resolved = await gzip.resolveRawEmailList(counting, results);
  assert.deepEqual(calls, { batch: 3, query: 0 });
  assert.deepEqual(resolved.map((row) => Buffer.byteLength(row.raw)),
    [...Array.from({ length: 25 }, (_, i) => 1_000_100 + i), Buffer.byteLength('From: a\r\n\r\nsmall')]);
});

test('before migration, large mail is still stored in one row', async (t) => {
  const db = await createDb(t, `CREATE TABLE raw_mails (id INTEGER PRIMARY KEY, message_id TEXT, source TEXT,
    address TEXT, raw TEXT, raw_blob BLOB, metadata TEXT, is_unread INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  const storage = await loadStorage();
  const raw = mailOfSize(2_100_000);
  const { success } = await storage.storeRawMail({ DB: createD1Mock(db) }, 'sender@test', 'user@test', null, raw);
  assert.equal(success, true);
  assert.equal(db.prepare('SELECT raw FROM raw_mails').get().raw, raw);
});

test('migration from v0.0.11 adds chunk storage and keeps existing mail and deletes working', async (t) => {
  const settings = new Map();
  const migrator = (await loadTsModule('../../../worker/src/admin_api/db_api.ts', {
    CONSTANTS,
    compareVersions,
    utils: {
      getSetting: async (_c, key) => settings.get(key) ?? null,
      saveSetting: async (_c, key, value) => { settings.set(key, value); },
    },
  })).default;
  // A v0.0.11 database: the current schema without chunk storage
  const db = await createDb(t);
  db.exec(`DROP TABLE raw_mail_chunks;
    DROP INDEX idx_raw_mails_raw_chunk_key;
    ALTER TABLE raw_mails DROP COLUMN raw_chunk_key;`);
  db.prepare("INSERT INTO raw_mails (address, raw) VALUES ('old@test', 'old mail')").run();
  settings.set(CONSTANTS.DB_VERSION_KEY, 'v0.0.11');

  const res = await migrator.migrate({ env: { DB: createD1Mock(db) }, json: (body) => Response.json(body) });
  assert.equal((await res.json()).message, 'Database migrated');
  assert.equal(settings.get(CONSTANTS.DB_VERSION_KEY), CONSTANTS.DB_VERSION);
  assert.ok(db.prepare('PRAGMA index_list(raw_mails)').all().some(
    (index) => index.name === 'idx_raw_mails_raw_chunk_key' && index.unique === 1));
  assert.deepEqual(db.prepare('PRAGMA foreign_key_list(raw_mail_chunks)').all().map(
    ({ table, from, to, on_delete }) => ({ table, from, to, on_delete })),
  [{ table: 'raw_mails', from: 'chunk_key', to: 'raw_chunk_key', on_delete: 'CASCADE' }]);

  const env = { DB: createD1Mock(db) };
  const storage = await loadStorage();
  await storage.storeRawMail(env, 'sender@test', 'new@test', null, mailOfSize(2_100_000));
  const { results } = await env.DB.prepare('SELECT * FROM raw_mails ORDER BY id').all();
  assert.equal((await gzip.resolveRawEmailList(env.DB, results))[0].raw, 'old mail');
  db.exec('DELETE FROM raw_mails');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM raw_mail_chunks').get().n, 0);
});
