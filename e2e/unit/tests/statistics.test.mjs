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
    const call = async (api, params = {}, origin = 'https://stats.test') => {
        const response = await api.get({
            env, req: { url: `${origin}/admin/statistics?${new URLSearchParams(params)}`, query: () => params },
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

test('totals filter the selected domain directly and ignore date parameters', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    f.db.prepare('UPDATE address SET updated_at = ? WHERE name = ?').run(`${day(-10)} 00:00:00`, 'three@b.test');
    const results = await Promise.all(['b.test', 'a.test'].map(domain => f.call(api, { view: 'totals', domain, from: 'ignored', to: 'ignored' }).then(r => r.json())));
    assert.equal(f.batches(), 2); assert.equal(f.queries.length, 8);
    assert.equal(results[0].mailCount, 1); assert.equal(results[1].mailCount, 3);
    assert.equal(results[0].userCount, 1); assert.equal(results[1].userCount, 1);
    assert.deepEqual(results.map(result => [result.activeAddressCount7days, result.activeAddressCount30days]), [[0, 1], [2, 2]]);
    assert.equal(f.queries.filter(sql => sql.includes('COLLATE NOCASE')).length, 6);
    assert.equal(f.queries.every(sql => !sql.includes('GROUP BY')), true);
    const response = await f.call(api, { view: 'totals' });
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
    assert.equal((await (await f.call(api, { view: 'totals' })).json()).mailCount, 5);
    f.db.prepare('INSERT INTO raw_mails(address,created_at) VALUES(?,?)').run('new@a.test', `${day(0)} 01:00:00`);
    assert.equal((await (await f.call(api, { view: 'totals' })).json()).mailCount, 6);
    assert.equal(f.batches(), 2);
});

test('trends query the selected range and domain, preserve empty days and keep users site-wide', async t => {
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const range = { from: day(-6), to: day(0) };
    const all = await (await f.call(api, range)).json();
    const a = await (await f.call(api, { ...range, domain: 'a.test' })).json();
    const b = await (await f.call(api, { ...range, domain: 'b.test' })).json();
    assert.equal(f.batches(), 3); assert.equal(all.daily.length, 7);
    assert.equal(all.daily.reduce((n, d) => n + d.mailCount, 0), 4);
    assert.equal(all.daily.reduce((n, d) => n + d.userCount, 0), 1);
    assert.equal(a.daily.reduce((n, d) => n + d.mailCount, 0), 2);
    assert.equal(b.daily.reduce((n, d) => n + d.mailCount, 0), 1);
    assert.deepEqual(a.daily.map(d => d.userCount), b.daily.map(d => d.userCount));
    assert.equal(all.daily[1].mailCount, 0);
    assert.equal((await f.call(api, { from: day(-40), to: day(0) })).status, 400);
    assert.equal((await f.call(api, { ...range, domain: 'unknown.test' })).status, 400);
    assert.equal(f.batches(), 3);
});

test('an hourly query that crosses UTC midnight retains the full requested day', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-07T23:59:59.500Z') });
    const f = fixture(); t.after(() => f.db.close()); const api = await createApi();
    const today = day(0);
    const insert = f.db.prepare('INSERT INTO raw_mails(address,created_at) VALUES(?,?)');
    insert.run('late@a.test', `${today} 23:59:59`);
    insert.run('tomorrow@a.test', `${day(1)} 00:00:00`);
    const batch = f.env.DB.batch;
    f.env.DB.batch = async statements => {
        const results = await batch(statements);
        t.mock.timers.tick(1000);
        return results;
    };

    const result = await (await f.call(api, { from: today, to: today })).json();
    assert.equal(result.interval, 'hour');
    assert.equal(result.daily.length, 24);
    assert.equal(result.daily[23].day, `${today} 23:00`);
    assert.equal(result.daily[23].mailCount, 1);
    assert.equal(result.daily.reduce((n, point) => n + point.mailCount, 0), 2);
});

test('database failures propagate and later requests recover', async t => {
    const f = fixture(); t.after(() => f.db.close());
    await f.call(await createApi(), { view: 'totals' });
    const api = await createApi(), batch = f.env.DB.batch;
    f.env.DB.batch = async () => { throw new Error('database unavailable'); };
    await assert.rejects(() => f.call(api, { view: 'totals' }), /database unavailable/);
    f.env.DB.batch = batch;
    await f.call(api, { view: 'totals' }); assert.equal(f.batches(), 2);
});
