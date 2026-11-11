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
type CountRow = { day: string; count: number };
const domainCondition = (column: string) => `substr(${column}, instr(${column}, '@') + 1) = ? COLLATE NOCASE`;
const sqlTime = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');

const getTotals = async (c: Context<HonoCustomType>, domain: string, includeUserActivity: boolean) => {
    const results = await c.env.DB.batch<Record<string, number>>(metrics.map(([key, table, column]) => {
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

const get = async (c: Context<HonoCustomType>) => {
    const { from, to, domain: domainQuery, view } = c.req.query();
    const domain = domainQuery?.trim().toLowerCase() || '';
    const msgs = i18n.getMessagesbyContext(c);
    if (domain && !getDomains(c).includes(domain)) return c.text(msgs.InvalidStatisticsDomainMsg, 400);
    if (view === 'totals' || (!from && !to && !domain)) {
        return c.json(await getTotals(c, domain, view === 'totals'), 200, noStore);
    }

    const start = Date.parse(from);
    const lastDay = Date.parse(to);
    const validDay = (value: string, timestamp: number) => /^\d{4}-\d{2}-\d{2}$/.test(value)
        && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
    if (!validDay(from, start) || !validDay(to, lastDay) || lastDay < start || lastDay - start >= 30 * DAY || lastDay > Date.now()) {
        return c.text(msgs.InvalidStatisticsRangeMsg, 400);
    }
    const end = lastDay + DAY;
    const hourly = from === to;
    const step = hourly ? DAY / 24 : DAY;
    const interval = hourly ? 'hour' : 'day';
    const format = hourly ? '%Y-%m-%d %H:00' : '%Y-%m-%d';
    const buckets = Array.from({ length: (end - start) / step }, (_, i) => sqlTime(start + i * step));
    const placeholders = buckets.map(() => '(?)').join(', ');
    const results = await c.env.DB.batch<CountRow>(metrics.map(([, table, column]) => {
        if (!column) {
            return c.env.DB.prepare(`SELECT strftime('${format}', created_at) AS day, count(*) AS count FROM ${table}
                WHERE created_at >= ? AND created_at < ? GROUP BY day`).bind(buckets[0], sqlTime(end));
        }
        return c.env.DB.prepare(
            `WITH buckets(start_time) AS (VALUES ${placeholders})
             SELECT strftime('${format}', start_time) AS day, (
                SELECT count(*) FROM ${table}
                WHERE created_at >= start_time AND created_at < datetime(start_time, '+1 ${interval}')${domain
                    ? ` AND ${domainCondition(column)}` : ''}
             ) AS count FROM buckets`
        ).bind(...buckets, ...(domain ? [domain] : []));
    }));
    return c.json(Object.fromEntries(metrics.map(([key], i) => [key, results[i].results])), 200, noStore);
};

export default { get };
