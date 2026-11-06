import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

let sequence = 0;
const day = offset => new Date(Date.parse(new Date().toISOString().slice(0, 10)) + offset * 86400000).toISOString().slice(0, 10);
const apiUrl = new URL('../../../worker/src/admin_api/statistics_api.ts', import.meta.url);
const cacheUrl = new URL('../../../worker/src/admin_api/statistics_cache.ts', import.meta.url);
const createApi = async () => {
    const source = `import { getStatisticsSnapshot } from '${cacheUrl.href}?isolate=${++sequence}';
        const getDomains = c => c.env.DOMAINS;
        const i18n = { getMessagesbyContext: () => ({ InvalidStatisticsRangeMsg: 'range', InvalidStatisticsDomainMsg: 'domain' }) };
        ${readFileSync(apiUrl, 'utf8').replace(/^import .*\n/gm, '')}`;
    return (await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`)).default;
};
const fixture = () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(new URL('../../../db/schema.sql', import.meta.url), 'utf8'));
    for (const [address, offset] of [['one@a.test', 0], ['two@A.TEST', -6], ['three@b.test', -2], ['old@a.test', -40], [null, -1]]) {
        db.prepare('INSERT INTO raw_mails(address,created_at) VALUES(?,?)').run(address, `${day(offset)} 00:00:00`);
        if (address) {
            db.prepare('INSERT INTO address(name,created_at,updated_at) VALUES(?,?,?)').run(address, `${day(offset)} 00:00:00`, `${day(offset)} 00:00:00`);
            db.prepare('INSERT INTO sendbox(address,created_at) VALUES(?,?)').run(address, `${day(offset)} 00:00:00`);
        }
    }
    db.prepare('INSERT INTO users(user_email,password,created_at) VALUES(?,?,?)').run('registered@example.com', 'test', `${day(-2)} 00:00:00`);
    const edge = new Map();
    const queries = [];
    let batches = 0;
    globalThis.caches = { default: {
        match: async request => { const entry = edge.get(request.url); return entry && entry.expiresAt > Date.now() ? entry.response.clone() : undefined; },
        put: async (request, response) => { edge.set(request.url, { response: response.clone(), expiresAt: Date.now() + 600000 }); },
    } };
    const env = {
        DOMAINS: ['a.test', 'b.test'],
        DB: {
            prepare: sql => ({ sql, params: [], bind(...params) { this.params = params; return this; }, async first() { queries.push(sql); return db.prepare(sql).get(...this.params); } }),
            batch: async statements => {
                batches++;
                return statements.map(statement => { queries.push(statement.sql); return { results: db.prepare(statement.sql).all(...statement.params) }; });
            },
        },
    };
    const call = async (api, params = {}, origin = 'https://stats.test') => {
        const response = await api.get({
            env, req: { url: `${origin}/admin/statistics?${new URLSearchParams(params)}`, query: () => params },
            json: (data, status, headers) => new Response(JSON.stringify(data), { status, headers }),
            text: (body, status) => new Response(body, { status }),
        });
        return response;
    };
    return { db, env, edge, queries, call, batches: () => batches };
};

test('concurrent totals, domains and irrelevant dates share one aggregation', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => f.call(api, { view: 'totals', domain: i % 2 ? 'a.test' : 'b.test', from: String(i), to: 'ignored' }).then(r => r.json())));
    assert.equal(f.batches(), 1); assert.equal(f.queries.length, 4);
    assert.equal(results[0].mailCount, 1); assert.equal(results[1].mailCount, 3);
    assert.equal(results[0].userCount, 1); assert.equal(results[1].userCount, 1);
    const all = await (await f.call(api, { view: 'totals' })).json();
    assert.equal(all.mailCount, 5); assert.equal(all.addressCount, 4); assert.equal(all.sendMailCount, 4);
    assert.equal(f.batches(), 2);
    assert.equal(f.queries.slice(-4).every(sql => !sql.includes('GROUP BY')), true);
});

test('Worker isolates reuse the edge cache without KV, with origin and data-center isolation', async t => {
    const f = fixture(); t.after(() => f.db.close());
    f.env.KV = { get: () => assert.fail('KV must not be read'), put: () => assert.fail('KV must not be written') };
    await f.call(await createApi(), { view: 'totals' });
    await f.call(await createApi(), { view: 'totals' });
    assert.equal(f.batches(), 1);
    f.edge.clear();
    await f.call(await createApi(), { view: 'totals' });
    assert.equal(f.batches(), 2);
    await f.call(await createApi(), { view: 'totals' }, 'https://other.test');
    assert.equal(f.batches(), 3);
});

test('trends use the exact range, preserve empty days and reuse every domain and user count', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const range = { from: day(-6), to: day(0) };
    const all = await (await f.call(api, range)).json();
    const a = await (await f.call(api, { ...range, domain: 'a.test' })).json();
    const b = await (await f.call(api, { ...range, domain: 'b.test' })).json();
    assert.equal(f.batches(), 1); assert.equal(all.daily.length, 7);
    assert.equal(all.daily.reduce((n, d) => n + d.mailCount, 0), 4);
    assert.equal(a.daily.reduce((n, d) => n + d.mailCount, 0), 2);
    assert.equal(b.daily.reduce((n, d) => n + d.mailCount, 0), 1);
    assert.deepEqual(a.daily.map(d => d.userCount), b.daily.map(d => d.userCount));
    assert.equal(all.daily[1].mailCount, 0);
    assert.equal(f.queries.every(sql => sql.includes('created_at >= ? AND created_at < ?')), true);
    assert.match(f.db.prepare('EXPLAIN QUERY PLAN SELECT date(created_at),count(*) FROM users WHERE created_at>=? AND created_at<? GROUP BY date(created_at)').all(day(-6), day(1)).map(r => r.detail).join(' '), /COVERING INDEX idx_users_created_at/);
    assert.equal((await f.call(api, { from: day(-40), to: day(0) })).status, 400);
    assert.equal((await f.call(api, { ...range, domain: 'unknown.test' })).status, 400);
    assert.equal(f.batches(), 1);
});

test('expired snapshots are rebuilt, and failures do not poison later requests', async t => {
    const f = fixture(); t.after(() => f.db.close());
    await f.call(await createApi(), { view: 'totals' });
    for (const value of f.edge.values()) value.expiresAt = 0;
    const api = await createApi(), batch = f.env.DB.batch;
    f.env.DB.batch = async () => { throw new Error('database unavailable'); };
    await assert.rejects(() => f.call(api, { view: 'totals' }), /database unavailable/);
    f.env.DB.batch = batch;
    await f.call(api, { view: 'totals' }); assert.equal(f.batches(), 2);
});

test('cache failures preserve concurrent coalescing without hiding database errors', async t => {
    const f = fixture(); t.after(() => f.db.close()); t.mock.method(console, 'warn', () => {});
    globalThis.caches = { default: { match: async () => { throw new Error('edge unavailable'); }, put: async () => { throw new Error('edge unavailable'); } } };
    const api = await createApi();
    await Promise.all(Array.from({ length: 20 }, () => f.call(api, { view: 'totals' })));
    assert.equal(f.batches(), 1);
});

test('v0.0.10 migration adds the user time index, preserves data and is idempotent', async t => {
    const f = fixture(); t.after(() => f.db.close());
    f.db.exec("DROP INDEX idx_users_created_at; INSERT INTO settings(key,value) VALUES('db_version','v0.0.10')");
    let ddl = 0;
    f.env.DB.exec = async sql => { ddl++; f.db.exec(sql); };
    const prepare = f.env.DB.prepare;
    f.env.DB.prepare = sql => ({ ...prepare(sql), async run() { return f.db.prepare(sql).run(...this.params); } });
    const constants = new URL('../../../worker/src/constants.ts', import.meta.url);
    const version = new URL('../../../worker/src/utils/version.ts', import.meta.url);
    const source = `import { CONSTANTS } from '${constants.href}'; import { compareVersions } from '${version.href}';
        const utils = {
            getSetting: async (c,key) => (await c.env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first())?.value,
            saveSetting: async (c,key,value) => c.env.DB.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').bind(key,value).run()
        };
        ${readFileSync(new URL('../../../worker/src/admin_api/db_api.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '')}`;
    const { default: migration } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
    const context = { env: f.env, json: data => data };
    assert.equal((await migration.migrate(context)).success, true);
    assert.equal(f.db.prepare("SELECT value FROM settings WHERE key='db_version'").get().value, 'v0.0.11');
    assert.equal(f.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='idx_users_created_at'").get().n, 1);
    assert.equal(f.db.prepare('SELECT count(*) n FROM raw_mails').get().n, 5);
    const previousDdl = ddl;
    await migration.migrate(context);
    assert.equal(ddl, previousDdl);
});
