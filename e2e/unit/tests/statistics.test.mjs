import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const day = offset => new Date(Date.parse(new Date().toISOString().slice(0, 10)) + offset * 86400000).toISOString().slice(0, 10);
const bounds = (from, to) => ({ from: `${day(from)} 00:00:00`, to: `${day(to + 1)} 00:00:00`, granularity: 'day' });
const apiUrl = new URL('../../../worker/src/admin_api/statistics_api.ts', import.meta.url);
const createApi = async () => {
    const source = `const i18n = { getMessagesbyContext: () => ({ InvalidStatisticsRangeMsg: 'range', InvalidStatisticsGranularityMsg: 'granularity' }) };
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
        DB: {
            prepare: sql => ({ sql, params: [], bind(...params) { this.params = params; return this; }, async first() { queries.push(sql); return db.prepare(sql).get(...this.params); } }),
            batch: async statements => {
                batches++;
                return statements.map(statement => { queries.push(statement.sql); return { results: db.prepare(statement.sql).all(...statement.params) }; });
            },
        },
    };
    const call = async (api, params = {}) => {
        const response = await api.get({
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
    const result = await (await f.call(api)).json();
    assert.deepEqual(result, {
        mailCount: 5, addressCount: 4, userCount: 1, sendMailCount: 4,
        activeAddressCount7days: 2, activeAddressCount30days: 3,
    });
    assert.equal(f.queries.length, 4);
});

test('one statistics request batches site-wide totals and trends', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    f.db.prepare('UPDATE address SET updated_at = ? WHERE name = ?').run(`${day(-10)} 00:00:00`, 'three@b.test');
    f.db.prepare('UPDATE users SET updated_at = ?').run(`${day(-1)} 00:00:00`);
    const addUser = f.db.prepare('INSERT INTO users(user_email,password,created_at,updated_at) VALUES(?,?,?,?)');
    addUser.run('returning@example.com', 'test', `${day(-40)} 00:00:00`, `${day(-10)} 00:00:00`);
    addUser.run('inactive@example.com', 'test', `${day(-40)} 00:00:00`, `${day(-40)} 00:00:00`);
    const response = await f.call(api, { ...bounds(-6, 0), includeTotals: 'true' });
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    const { totals, trends } = await response.json();
    assert.deepEqual(totals, {
        mailCount: 5, addressCount: 4, sendMailCount: 4, userCount: 3,
        activeAddressCount7days: 2, activeAddressCount30days: 3,
        activeUserCount7days: 1, activeUserCount30days: 2,
    });
    assert.equal(trends.mailCount.reduce((sum, row) => sum + row.count, 0), 4);
    assert.equal(f.batches(), 1); assert.equal(f.queries.length, 8);
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
    const params = { ...bounds(-6, 0), includeTotals: 'true' };
    assert.equal((await (await f.call(api, params)).json()).totals.mailCount, 5);
    f.db.prepare('INSERT INTO raw_mails(address,created_at) VALUES(?,?)').run('new@a.test', `${day(0)} 01:00:00`);
    assert.equal((await (await f.call(api, params)).json()).totals.mailCount, 6);
    assert.equal(f.batches(), 2);
});

test('trends return counts for all four metrics in the requested dates', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const range = bounds(-6, 0);
    const { totals, trends } = await (await f.call(api, range)).json();
    assert.equal(totals, undefined);
    assert.equal(trends.mailCount.length, 7);
    assert.equal(trends.mailCount.reduce((sum, row) => sum + row.count, 0), 4);
    assert.equal(trends.addressCount.reduce((sum, row) => sum + row.count, 0), 3);
    assert.deepEqual(trends.sendMailCount, trends.addressCount);
    assert.deepEqual(trends.userCount, [{ day: day(-2), count: 1 }]);
    assert.equal((await f.call(api, { from: '', to: '' })).status, 400);
    assert.equal((await f.call(api, { from: range.from })).status, 400);
    assert.equal((await f.call(api, bounds(-40, 0))).status, 400);
    assert.equal((await f.call(api, { ...range, from: `${day(-6)} 01:00:00` })).status, 400);
    assert.equal((await f.call(api, { ...range, from: '2026-02-30 00:00:00' })).status, 400);
    const invalidGranularity = await f.call(api, { ...range, granularity: 'hour' });
    assert.equal(invalidGranularity.status, 400);
    assert.equal(await invalidGranularity.text(), 'granularity');
    assert.equal(f.batches(), 1); assert.equal(f.queries.length, 4);
});

test('single-day aggregates respect UTC day boundaries', async t => {
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
        .run('daily@example.com', 'test', `${day(-1)} 04:30:00`);
    const { trends: past } = await (await f.call(api, bounds(-1, -1))).json();
    assert.deepEqual(past.mailCount, [{ day: day(-1), count: 3 }]);
    for (const key of ['addressCount', 'sendMailCount']) {
        assert.deepEqual(past[key], [{ day: day(-1), count: 2 }]);
    }
    assert.deepEqual(past.userCount, [{ day: day(-1), count: 1 }]);
    const { trends: today } = await (await f.call(api, bounds(0, 0))).json();
    assert.deepEqual(today.mailCount, [{ day: day(0), count: 2 }]);
});

test('daily trends use the existing creation-time indexes', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const batch = f.env.DB.batch;
    const plans = [];
    f.env.DB.batch = async statements => {
        plans.push(statements.flatMap(({ sql, params }) =>
            f.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params).map(row => row.detail)));
        return batch(statements);
    };

    assert.equal((await f.call(api, bounds(-29, 0))).status, 200);
    for (const table of ['raw_mails', 'address', 'sendbox']) {
        assert.ok(plans[0].some(line => line.startsWith(`SEARCH ${table} USING COVERING INDEX idx_${table}_`)
            && line.includes('created_at>? AND created_at<?')), plans[0].join('\n'));
    }
    assert.equal(plans[0].filter(line => line.includes('USE TEMP B-TREE FOR GROUP BY')).length, 1);
});

test('database failures propagate and later requests recover', async t => {
    const f = fixture(); t.after(() => f.db.close());
    const params = { ...bounds(-6, 0), includeTotals: 'true' };
    await f.call(await createApi(), params);
    const api = await createApi(), batch = f.env.DB.batch;
    f.env.DB.batch = async () => { throw new Error('database unavailable'); };
    await assert.rejects(() => f.call(api, params), /database unavailable/);
    f.env.DB.batch = batch;
    await f.call(api, params); assert.equal(f.batches(), 2);
});
