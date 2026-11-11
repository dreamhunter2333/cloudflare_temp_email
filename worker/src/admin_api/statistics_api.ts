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
type CountRow = { day: string; count: number };
const domainCondition = (column: string) => `substr(${column}, instr(${column}, '@') + 1) = ? COLLATE NOCASE`;
const parseDay = (value: string) => {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
};

const queryTotals = async (c: Context<HonoCustomType>, domain: string, includeUserActivity: boolean, selectedMetrics: readonly Metric[]) => {
    const results = await c.env.DB.batch<Record<string, number>>(selectedMetrics.map(([key, table, column]) => {
        const filter = domain && column;
        const activityKey = table === 'address' ? 'activeAddressCount' :
            table === 'users' && includeUserActivity ? 'activeUserCount' : '';
        const activity = activityKey ? `,
            count(CASE WHEN updated_at > datetime('now', '-7 days') THEN 1 END) AS ${activityKey}7days,
            count(CASE WHEN updated_at > datetime('now', '-30 days') THEN 1 END) AS ${activityKey}30days` : '';
        const statement = c.env.DB.prepare(`SELECT count(*) AS ${key}${activity} FROM ${table}${filter
            ? ` WHERE ${domainCondition(filter)}` : ''}`);
        return filter ? statement.bind(domain) : statement;
    }));
    return Object.assign({}, ...results.map(result => result.results[0]));
};

const readFilters = (c: Context<HonoCustomType>) => {
    const { from, to, domain: domainQuery, skipUsers } = c.req.query();
    const domain = domainQuery?.trim().toLowerCase() || '';
    const selectedMetrics = skipUsers === 'true' ? metrics.filter(([key]) => key !== 'userCount') : metrics;
    return { from, to, domain, selectedMetrics, invalidDomain: domain && !getDomains(c).includes(domain) };
};

const get = async (c: Context<HonoCustomType>) => c.json(await queryTotals(c, '', false, metrics), 200, noStore);

const totals = async (c: Context<HonoCustomType>) => {
    const { domain, selectedMetrics, invalidDomain } = readFilters(c);
    if (invalidDomain) return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsDomainMsg, 400);
    return c.json(await queryTotals(c, domain, true, selectedMetrics), 200, noStore);
};

const trends = async (c: Context<HonoCustomType>) => {
    const { from, to, domain, selectedMetrics, invalidDomain } = readFilters(c);
    if (invalidDomain) return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsDomainMsg, 400);
    const start = parseDay(from);
    const lastDay = parseDay(to);
    if (!(start <= lastDay && lastDay <= Date.now() && lastDay - start < 30 * DAY)) {
        return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsRangeMsg, 400);
    }
    const startTime = `${from} 00:00:00`;
    const endTime = `${new Date(lastDay + DAY).toISOString().slice(0, 10)} 00:00:00`;
    const [step, format] = from === to ? ['+1 hour', '%Y-%m-%d %H:00'] : ['+1 day', '%Y-%m-%d'];

    const results = await c.env.DB.batch<CountRow>(selectedMetrics.map(([, table, column]) => {
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
    }));
    return c.json(Object.fromEntries(selectedMetrics.map(([key], i) => [key, results[i].results])), 200, noStore);
};

export default { get, totals, trends };
