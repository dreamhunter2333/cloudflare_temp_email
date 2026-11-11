import type { Context } from 'hono'
import { getDomains } from '../utils'
import i18n from '../i18n'

const DAY = 86400000;
const noStore = { 'Cache-Control': 'private, no-store' };
const metrics = [
    ['mailCount', 'raw_mails', 'address'],
    ['addressCount', 'address', 'name'],
    ['userCount', 'users', null],
    ['sendMailCount', 'sendbox', 'address'],
] as const;
const domainCondition = (column: string) => `substr(${column}, instr(${column}, '@') + 1) = ? COLLATE NOCASE`;
const parseMidnight = (value = '') => {
    if (!/^\d{4}-\d{2}-\d{2} 00:00:00$/.test(value)) return NaN;
    const day = value.slice(0, 10);
    const timestamp = Date.parse(day);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day ? timestamp : NaN;
};

const totalStatements = (db: D1Database, domain: string, legacy = false) => {
    const forDomain = (sql: string, column: string) => domain
        ? db.prepare(`${sql} WHERE ${domainCondition(column)}`).bind(domain)
        : db.prepare(sql);
    return [
        forDomain('SELECT count(*) AS mailCount FROM raw_mails', 'address'),
        forDomain(`SELECT count(*) AS addressCount,
            count(*) FILTER (WHERE updated_at > datetime('now', '-7 days')) AS activeAddressCount7days,
            count(*) FILTER (WHERE updated_at > datetime('now', '-30 days')) AS activeAddressCount30days
            FROM address`, 'name'),
        forDomain('SELECT count(*) AS sendMailCount FROM sendbox', 'address'),
        db.prepare(legacy ? 'SELECT count(*) AS userCount FROM users' :
            `SELECT count(*) AS userCount,
             count(*) FILTER (WHERE updated_at > datetime('now', '-7 days')) AS activeUserCount7days,
             count(*) FILTER (WHERE updated_at > datetime('now', '-30 days')) AS activeUserCount30days
             FROM users`),
    ];
};

const get = async (c: Context<HonoCustomType>) => {
    const { from, to, domain: domainQuery, granularity, includeTotals } = c.req.query();
    const domain = domainQuery?.trim().toLowerCase() || '';
    if (from === undefined && to === undefined && granularity === undefined && !domain) {
        const totals = await c.env.DB.batch(totalStatements(c.env.DB, '', true));
        return c.json(Object.assign({}, ...totals.map(result => result.results[0])), 200, noStore);
    }
    if (domain && !getDomains(c).includes(domain)) {
        return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsDomainMsg, 400);
    }
    const start = parseMidnight(from);
    const end = parseMidnight(to);
    if (!(start < end && end - start <= 30 * DAY && end - DAY <= Date.now())) {
        return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsRangeMsg, 400);
    }
    if (granularity !== 'day') {
        return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsGranularityMsg, 400);
    }
    const totalsQueries = includeTotals === 'true' ? totalStatements(c.env.DB, domain) : [];

    const trendQueries = metrics.map(([, table, column]) => {
        if (!column) {
            return c.env.DB.prepare(
                `SELECT date(created_at) AS day, count(*) AS count
                 FROM ${table} WHERE created_at >= ? AND created_at < ? GROUP BY day`
            ).bind(from, to);
        }

        const domainFilter = domain ? ` AND ${domainCondition(column)}` : '';
        return c.env.DB.prepare(
            `WITH RECURSIVE time_ranges(start_time, end_time) AS (
                SELECT ?, datetime(?, '+1 day')
                UNION ALL
                SELECT end_time, datetime(end_time, '+1 day') FROM time_ranges WHERE end_time < ?
             )
             SELECT date(start_time) AS day, (
                SELECT count(*) FROM ${table}
                WHERE created_at >= time_ranges.start_time AND created_at < time_ranges.end_time${domainFilter}
             ) AS count FROM time_ranges`
        ).bind(from, from, to, ...(domain ? [domain] : []));
    });
    const results = await c.env.DB.batch([...totalsQueries, ...trendQueries]);
    const trendResults = results.slice(totalsQueries.length);
    const trends = Object.fromEntries(metrics.map(([key], i) => [key, trendResults[i].results]));
    const totals = totalsQueries.length ? Object.assign({}, ...results.slice(0, totalsQueries.length).map(result => result.results[0])) : undefined;
    return c.json({ totals, trends }, 200, noStore);
};

export default { get };
