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
type Metric = typeof metrics[number];
const domainCondition = (column: string) => `substr(${column}, instr(${column}, '@') + 1) = ? COLLATE NOCASE`;
const isUtcMidnight = (value: string, timestamp: number) => timestamp % DAY === 0
    && /^\d{4}-/.test(value) && new Date(timestamp).toISOString() === value;

const totalStatements = (c: Context<HonoCustomType>, domain: string, includeUserActivity: boolean, selectedMetrics: readonly Metric[]) =>
    selectedMetrics.map(([key, table, column]) => {
        const filter = domain && column;
        const activityKey = table === 'address' ? 'activeAddressCount' :
            table === 'users' && includeUserActivity ? 'activeUserCount' : '';
        const activity = activityKey ? `,
            count(CASE WHEN updated_at > datetime('now', '-7 days') THEN 1 END) AS ${activityKey}7days,
            count(CASE WHEN updated_at > datetime('now', '-30 days') THEN 1 END) AS ${activityKey}30days` : '';
        const statement = c.env.DB.prepare(`SELECT count(*) AS ${key}${activity} FROM ${table}${filter
            ? ` WHERE ${domainCondition(filter)}` : ''}`);
        return filter ? statement.bind(domain) : statement;
    });

const get = async (c: Context<HonoCustomType>) => {
    const { from, to, domain: domainQuery, includeTotals, skipUsers } = c.req.query();
    const domain = domainQuery?.trim().toLowerCase() || '';
    if (!from && !to && !domain) {
        const totals = await c.env.DB.batch(totalStatements(c, '', false, metrics));
        return c.json(Object.assign({}, ...totals.map(result => result.results[0])), 200, noStore);
    }
    if (domain && !getDomains(c).includes(domain)) {
        return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsDomainMsg, 400);
    }
    const start = Date.parse(from);
    const end = Date.parse(to);
    if (!isUtcMidnight(from, start) || !isUtcMidnight(to, end) || end <= start || end - start > 30 * DAY || end - DAY > Date.now()) {
        return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsRangeMsg, 400);
    }
    const startTime = from.slice(0, 19).replace('T', ' ');
    const endTime = to.slice(0, 19).replace('T', ' ');
    const [step, format] = end - start === DAY ? ['+1 hour', '%Y-%m-%d %H:00'] : ['+1 day', '%Y-%m-%d'];
    const selectedMetrics = skipUsers === 'true' ? metrics.filter(([key]) => key !== 'userCount') : metrics;
    const totalsQueries = includeTotals === 'true' ? totalStatements(c, domain, true, selectedMetrics) : [];

    const trendQueries = selectedMetrics.map(([, table, column]) => {
        if (!column) {
            return c.env.DB.prepare(
                `SELECT strftime(?, created_at) AS day, count(*) AS count
                 FROM ${table} WHERE created_at >= ? AND created_at < ? GROUP BY day`
            ).bind(format, startTime, endTime);
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
        ).bind(startTime, startTime, step, step, endTime, format, ...(domain ? [domain] : []));
    });
    const results = await c.env.DB.batch([...totalsQueries, ...trendQueries]);
    const trendResults = results.slice(totalsQueries.length);
    const trends = Object.fromEntries(selectedMetrics.map(([key], i) => [key, trendResults[i].results]));
    const totals = totalsQueries.length ? Object.assign({}, ...results.slice(0, totalsQueries.length).map(result => result.results[0])) : undefined;
    return c.json({ totals, trends }, 200, noStore);
};

export default { get };
