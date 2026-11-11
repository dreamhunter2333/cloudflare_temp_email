import type { Context } from 'hono'
import { getDomains } from '../utils'
import i18n from '../i18n'

const DAY = 86400000;
const metrics = [
    ['mailCount', 'raw_mails', 'address'],
    ['addressCount', 'address', 'name'],
    ['userCount', 'users', null],
    ['sendMailCount', 'sendbox', 'address'],
] as const;
type CountRow = { day: string; count: number };
const domainCondition = (column: string) => `substr(${column}, instr(${column}, '@') + 1) = ? COLLATE NOCASE`;

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
    const today = new Date().toISOString().slice(0, 10);
    const { from, to, domain: domainQuery, view } = c.req.query();
    const domain = domainQuery?.trim().toLowerCase() || '';
    const msgs = i18n.getMessagesbyContext(c);
    if (domain && !getDomains(c).includes(domain)) return c.text(msgs.InvalidStatisticsDomainMsg, 400);
    if (view === 'totals' || (!from && !to && !domain)) {
        const totals = await getTotals(c, domain, view === 'totals');
        return c.json(view === 'totals' ? { generatedAt: new Date().toISOString(), domain, ...totals } : totals,
            200, { 'Cache-Control': 'private, no-store' });
    }

    const startDay = from || new Date(Date.parse(today) - 29 * DAY).toISOString().slice(0, 10);
    const endDay = to || today;
    const start = Date.parse(startDay);
    const end = Date.parse(endDay) + DAY;
    const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
        && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!validDay(startDay) || !validDay(endDay) || end <= start || end - start > 30 * DAY || endDay > today) {
        return c.text(msgs.InvalidStatisticsRangeMsg, 400);
    }
    const hourly = end - start === DAY;
    const step = hourly ? DAY / 24 : DAY;
    const labelLength = hourly ? 16 : 10;
    const boundaries = Array.from({ length: (end - start) / step + 1 }, (_, i) =>
        new Date(start + i * step).toISOString().slice(0, 19).replace('T', ' '));
    const buckets = boundaries.slice(0, -1);
    const bucketValues = buckets.map(() => '(?, ?)').join(', ');
    const bucketParams = buckets.flatMap((time, i) => [time, boundaries[i + 1]]);
    const results = await c.env.DB.batch<CountRow>(metrics.map(([, table, column]) => {
        if (!column) {
            const day = hourly ? "strftime('%Y-%m-%d %H:00', created_at)" : 'date(created_at)';
            return c.env.DB.prepare(`SELECT ${day} AS day, count(*) AS count FROM ${table}
                WHERE created_at >= ? AND created_at < ? GROUP BY day`).bind(boundaries[0], boundaries[buckets.length]);
        }
        return c.env.DB.prepare(
            `WITH buckets(start_time, end_time) AS (VALUES ${bucketValues})
             SELECT substr(start_time, 1, ${labelLength}) AS day, (
                SELECT count(*) FROM ${table} WHERE created_at >= start_time AND created_at < end_time${domain
                    ? ` AND ${domainCondition(column)}` : ''}
             ) AS count FROM buckets`
        ).bind(...bucketParams, ...(domain ? [domain] : []));
    }));
    const generatedAt = new Date().toISOString();
    const counts = results.map(result => new Map(result.results.map(row => [row.day, row.count])));
    const visibleBuckets = hourly && endDay === generatedAt.slice(0, 10)
        ? buckets.slice(0, new Date(generatedAt).getUTCHours() + 1) : buckets;
    const daily = visibleBuckets.map(time => {
        const day = time.slice(0, labelLength);
        return { day, ...Object.fromEntries(metrics.map(([key], i) => [key, counts[i].get(day) ?? 0])) };
    });
    return c.json({ generatedAt, from: startDay, to: endDay, domain, interval: hourly ? 'hour' : 'day', daily },
        200, { 'Cache-Control': 'private, no-store' });
};

export default { get };
