import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const day = offset => new Date(Date.parse(new Date().toISOString().slice(0, 10)) + offset * 86400000).toISOString().slice(0, 10);
const apiUrl = new URL('../../../worker/src/admin_api/statistics_api.ts', import.meta.url);
const createApi = async () => {
    const source = `const getDomains = c => c.env.DOMAINS;
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
    const queries = [];
    let batches = 0;
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
    const call = async (handler, params = {}) => {
        const response = await handler({
            env, req: { query: () => params },
            json: (data, status, headers) => new Response(JSON.stringify(data), { status, headers }),
            text: (body, status) => new Response(body, { status }),
        });
        return response;
    };
    return { db, env, queries, call, batches: () => batches };
};

test('legacy statistics return only totals and activity without a trend query', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    f.db.prepare('UPDATE address SET updated_at = ? WHERE name = ?').run(`${day(-10)} 00:00:00`, 'three@b.test');
    const result = await (await f.call(api.get)).json();
    assert.deepEqual(result, {
        mailCount: 5, addressCount: 4, userCount: 1, sendMailCount: 4,
        activeAddressCount7days: 2, activeAddressCount30days: 3,
    });
    assert.equal(f.queries.length, 4);
});

test('totals filter the selected domain directly and ignore date parameters', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    f.db.prepare('UPDATE address SET updated_at = ? WHERE name = ?').run(`${day(-10)} 00:00:00`, 'three@b.test');
    f.db.prepare('UPDATE users SET updated_at = ?').run(`${day(-1)} 00:00:00`);
    const addUser = f.db.prepare('INSERT INTO users(user_email,password,created_at,updated_at) VALUES(?,?,?,?)');
    addUser.run('returning@example.com', 'test', `${day(-40)} 00:00:00`, `${day(-10)} 00:00:00`);
    addUser.run('inactive@example.com', 'test', `${day(-40)} 00:00:00`, `${day(-40)} 00:00:00`);
    const results = await Promise.all(['b.test', 'a.test'].map(domain => f.call(api.totals, { domain, from: 'ignored', to: 'ignored' }).then(r => r.json())));
    assert.equal(f.batches(), 2); assert.equal(f.queries.length, 8);
    assert.equal(results[0].mailCount, 1); assert.equal(results[1].mailCount, 3);
    assert.deepEqual(results.map(result => [result.userCount, result.activeUserCount7days, result.activeUserCount30days]), [[3, 1, 2], [3, 1, 2]]);
    assert.deepEqual(results.map(result => [result.activeAddressCount7days, result.activeAddressCount30days]), [[0, 1], [2, 2]]);
    assert.equal(f.queries.filter(sql => sql.includes('COLLATE NOCASE')).length, 6);
    assert.equal(f.queries.every(sql => !sql.includes('GROUP BY')), true);
    const response = await f.call(api.totals);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    const all = await response.json();
    assert.equal(all.mailCount, 5); assert.equal(all.addressCount, 4); assert.equal(all.sendMailCount, 4);
    assert.equal(f.batches(), 3);
    assert.equal(f.queries.slice(-4).every(sql => !sql.includes('WHERE')), true);
});

test('statistics return fresh counts without accessing Cache API or KV', async t => {
    const f = fixture(); t.after(() => f.db.close());
    const previousCache = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    t.after(() => {
        if (previousCache) Object.defineProperty(globalThis, 'caches', previousCache);
        else delete globalThis.caches;
    });
    globalThis.caches = { default: {
        match: () => assert.fail('Cache API must not be read'),
        put: () => assert.fail('Cache API must not be written'),
    } };
    f.env.KV = { get: () => assert.fail('KV must not be read'), put: () => assert.fail('KV must not be written') };
    const api = await createApi();
    assert.equal((await (await f.call(api.totals)).json()).mailCount, 5);
    f.db.prepare('INSERT INTO raw_mails(address,created_at) VALUES(?,?)').run('new@a.test', `${day(0)} 01:00:00`);
    assert.equal((await (await f.call(api.totals)).json()).mailCount, 6);
    assert.equal(f.batches(), 2);
});

test('totals and trends can omit site-wide user queries', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const totals = await (await f.call(api.totals, { domain: 'a.test', skipUsers: 'true' })).json();
    const trends = await (await f.call(api.trends, { from: day(-6), to: day(0), skipUsers: 'true' })).json();
    assert.equal(totals.mailCount, 3);
    assert.equal(totals.activeAddressCount7days, 2);
    assert.equal(trends.mailCount.reduce((sum, row) => sum + row.count, 0), 4);
    assert.deepEqual(Object.keys(trends).sort(), ['addressCount', 'mailCount', 'sendMailCount']);
    assert.ok(!Object.keys(totals).some(key => /user/i.test(key)));
    assert.equal(f.queries.length, 6);
    assert.ok(f.queries.every(sql => !sql.includes('FROM users')));
});

test('trends return counts per metric for the requested dates and domain', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const range = { from: day(-6), to: day(0) };
    const all = await (await f.call(api.trends, range)).json();
    const a = await (await f.call(api.trends, { ...range, domain: 'a.test' })).json();
    const b = await (await f.call(api.trends, { ...range, domain: 'b.test' })).json();
    assert.equal(f.batches(), 3); assert.equal(all.mailCount.length, 7);
    assert.equal(all.mailCount.reduce((sum, row) => sum + row.count, 0), 4);
    assert.equal(a.mailCount.reduce((sum, row) => sum + row.count, 0), 2);
    assert.equal(b.mailCount.reduce((sum, row) => sum + row.count, 0), 1);
    assert.deepEqual(all.userCount, [{ day: day(-2), count: 1 }]);
    assert.deepEqual(a.userCount, all.userCount);
    assert.deepEqual(b.userCount, all.userCount);
    assert.equal((await f.call(api.trends, { domain: 'a.test' })).status, 400);
    assert.equal((await f.call(api.trends, { from: day(-6) })).status, 400);
    assert.equal((await f.call(api.trends, { from: day(-40), to: day(0) })).status, 400);
    assert.equal((await f.call(api.trends, { ...range, domain: 'unknown.test' })).status, 400);
    assert.equal(f.batches(), 3);
});

test('hourly aggregates respect UTC day boundaries', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-10T13:25:00Z') });
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    for (const [address, created] of [
        ['early@a.test', `${day(-1)} 00:00:00`],
        ['late@A.TEST', `${day(-1)} 23:59:59`],
        ['current@a.test', `${day(0)} 13:24:59`],
        ['next@a.test', `${day(1)} 00:00:00`],
    ]) {
        for (const [table, column] of [['raw_mails', 'address'], ['address', 'name'], ['sendbox', 'address']]) {
            f.db.prepare(`INSERT INTO ${table}(${column},created_at) VALUES(?,?)`).run(address, created);
        }
    }
    f.db.prepare('INSERT INTO users(user_email,password,created_at) VALUES(?,?,?)')
        .run('hourly@example.com', 'test', `${day(-1)} 04:30:00`);
    const past = await (await f.call(api.trends, { from: day(-1), to: day(-1), domain: 'a.test' })).json();
    for (const key of ['mailCount', 'addressCount', 'sendMailCount']) {
        assert.equal(past[key].length, 24);
        assert.deepEqual(past[key][0], { day: `${day(-1)} 00:00`, count: 1 });
        assert.deepEqual(past[key][23], { day: `${day(-1)} 23:00`, count: 1 });
        assert.equal(past[key].reduce((sum, row) => sum + row.count, 0), 2);
    }
    assert.deepEqual(past.userCount, [{ day: `${day(-1)} 04:00`, count: 1 }]);
    const today = await (await f.call(api.trends, { from: day(0), to: day(0), domain: 'a.test' })).json();
    assert.equal(today.mailCount[0].count, 1);
    assert.deepEqual(today.mailCount[13], { day: `${day(0)} 13:00`, count: 1 });
    assert.equal(today.mailCount.reduce((sum, row) => sum + row.count, 0), 2);
    const all = await (await f.call(api.trends, { from: day(-1), to: day(-1) })).json();
    assert.equal(all.mailCount[0].count, 2);
    assert.equal(all.mailCount.reduce((sum, row) => sum + row.count, 0), 3);
});

test('domain totals and trends use the mailbox-domain indexes', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const batch = f.env.DB.batch;
    const plans = [];
    f.env.DB.batch = async statements => {
        plans.push(statements.flatMap(({ sql, params }) =>
            f.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params).map(row => row.detail)));
        return batch(statements);
    };

    assert.equal((await f.call(api.totals, { domain: 'a.test' })).status, 200);
    assert.equal((await f.call(api.trends, { from: day(-29), to: day(0), domain: 'a.test' })).status, 200);
    for (const table of ['raw_mails', 'address', 'sendbox']) {
        const search = `SEARCH ${table}`;
        const index = `idx_${table}_mailbox_domain_created_at`;
        assert.ok(plans[0].some(line => line.startsWith(search) && line.includes(index)), plans[0].join('\n'));
        assert.ok(plans[1].some(line => line.startsWith(search) && line.includes(index)
            && line.includes('created_at>? AND created_at<?')), plans[1].join('\n'));
    }
    assert.equal(plans[1].filter(line => line.includes('USE TEMP B-TREE FOR GROUP BY')).length, 1);
});

test('database failures propagate and later requests recover', async t => {
    const f = fixture(); t.after(() => f.db.close());
    await f.call((await createApi()).totals);
    const api = await createApi(), batch = f.env.DB.batch;
    f.env.DB.batch = async () => { throw new Error('database unavailable'); };
    await assert.rejects(() => f.call(api.totals), /database unavailable/);
    f.env.DB.batch = batch;
    await f.call(api.totals); assert.equal(f.batches(), 2);
});
