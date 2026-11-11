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

const totalStatements = (db: D1Database, domain: string, { skipUsers = false, legacy = false } = {}) => {
    const forDomain = (sql: string, column: string) => domain
        ? db.prepare(`${sql} WHERE ${domainCondition(column)}`).bind(domain)
        : db.prepare(sql);
    const statements = [
        forDomain('SELECT count(*) AS mailCount FROM raw_mails', 'address'),
        forDomain(`SELECT count(*) AS addressCount,
            count(*) FILTER (WHERE updated_at > datetime('now', '-7 days')) AS activeAddressCount7days,
            count(*) FILTER (WHERE updated_at > datetime('now', '-30 days')) AS activeAddressCount30days
            FROM address`, 'name'),
        forDomain('SELECT count(*) AS sendMailCount FROM sendbox', 'address'),
    ];
    if (!skipUsers) {
        statements.push(db.prepare(legacy ? 'SELECT count(*) AS userCount FROM users' :
            `SELECT count(*) AS userCount,
             count(*) FILTER (WHERE updated_at > datetime('now', '-7 days')) AS activeUserCount7days,
             count(*) FILTER (WHERE updated_at > datetime('now', '-30 days')) AS activeUserCount30days
             FROM users`));
    }
    return statements;
};

const get = async (c: Context<HonoCustomType>) => {
    const { from, to, domain: domainQuery, includeTotals, skipUsers } = c.req.query();
    const domain = domainQuery?.trim().toLowerCase() || '';
    if (from === undefined && to === undefined && !domain) {
        const totals = await c.env.DB.batch(totalStatements(c.env.DB, '', { legacy: true }));
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
    const [step, format] = end - start === DAY ? ['+1 hour', '%Y-%m-%d %H:00'] : ['+1 day', '%Y-%m-%d'];
    const omitUsers = skipUsers === 'true';
    const selectedMetrics = omitUsers ? metrics.filter(([key]) => key !== 'userCount') : metrics;
    const totalsQueries = includeTotals === 'true' ? totalStatements(c.env.DB, domain, { skipUsers: omitUsers }) : [];

    const trendQueries = selectedMetrics.map(([, table, column]) => {
        if (!column) {
            return c.env.DB.prepare(
                `SELECT strftime(?, created_at) AS day, count(*) AS count
                 FROM ${table} WHERE created_at >= ? AND created_at < ? GROUP BY day`
            ).bind(format, from, to);
        }

        const domainFilter = domain ? ` AND ${domainCondition(column)}` : '';
        return c.env.DB.prepare(
            `WITH RECURSIVE time_ranges(start_time, end_time) AS (
                SELECT ?, datetime(?, ?)
                UNION ALL
                SELECT end_time, datetime(end_time, ?) FROM time_ranges WHERE end_time < ?
             )
             SELECT strftime(?, start_time) AS day, (
                SELECT count(*) FROM ${table}
                WHERE created_at >= time_ranges.start_time AND created_at < time_ranges.end_time${domainFilter}
             ) AS count FROM time_ranges`
        ).bind(from, from, step, step, to, format, ...(domain ? [domain] : []));
    });
    const results = await c.env.DB.batch([...totalsQueries, ...trendQueries]);
    const trendResults = results.slice(totalsQueries.length);
    const trends = Object.fromEntries(selectedMetrics.map(([key], i) => [key, trendResults[i].results]));
    const totals = totalsQueries.length ? Object.assign({}, ...results.slice(0, totalsQueries.length).map(result => result.results[0])) : undefined;
    return c.json({ totals, trends }, 200, noStore);
};

export default { get };
