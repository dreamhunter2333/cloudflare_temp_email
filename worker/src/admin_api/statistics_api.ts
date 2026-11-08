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
type CountRow = { day?: string; count: number };

const getTotals = async (c: Context<HonoCustomType>, domain = '') => {
    const results = await c.env.DB.batch<Record<string, number>>(metrics.map(([key, table, column]) => {
        const filter = domain && column;
        const activity = table === 'address' ? `,
            count(CASE WHEN updated_at > datetime('now', '-7 days') THEN 1 END) AS activeAddressCount7days,
            count(CASE WHEN updated_at > datetime('now', '-30 days') THEN 1 END) AS activeAddressCount30days` : '';
        const statement = c.env.DB.prepare(`SELECT count(*) AS ${key}${activity} FROM ${table}${filter
            ? ` WHERE substr(${column}, instr(${column}, '@') + 1) = ? COLLATE NOCASE` : ''}`);
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
    if (view === 'totals') {
        const totals = await getTotals(c, domain);
        return c.json({ generatedAt: new Date().toISOString(), domain, ...totals }, 200, { 'Cache-Control': 'private, no-store' });
    }

    if (!from && !to && !domain) {
        return c.json(await getTotals(c), 200, { 'Cache-Control': 'private, no-store' });
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
    const increment = hourly ? '+1 hour' : '+1 day';
    const startTime = `${startDay} 00:00:00`;
    const endTime = `${new Date(end).toISOString().slice(0, 10)} 00:00:00`;
    const results = await c.env.DB.batch<CountRow>(metrics.map(([, table, column]) => {
        if (table === 'users') {
            const bucket = hourly ? "strftime('%Y-%m-%d %H:00', created_at)" : 'date(created_at)';
            return c.env.DB.prepare(
                `SELECT ${bucket} AS day, count(*) AS count FROM ${table}
                 WHERE created_at >= ? AND created_at < ? GROUP BY day`
            ).bind(startTime, endTime);
        }
        return c.env.DB.prepare(
            `WITH RECURSIVE buckets(start) AS (
                VALUES (?)
                UNION ALL
                SELECT datetime(start, '${increment}') FROM buckets WHERE datetime(start, '${increment}') < ?
            )
            SELECT substr(buckets.start, 1, ${hourly ? 16 : 10}) AS day, (
                SELECT count(*) FROM ${table}
                WHERE created_at >= buckets.start AND created_at < datetime(buckets.start, '${increment}')${domain
                    ? ` AND substr(${column}, instr(${column}, '@') + 1) = ? COLLATE NOCASE` : ''}
            ) AS count FROM buckets`
        ).bind(startTime, endTime, ...(domain ? [domain] : []));
    }));
    const generatedAt = new Date().toISOString();
    const counts = results.map(result => new Map(result.results.map(row => [row.day, row.count])));
    const step = hourly ? DAY / 24 : DAY;
    const bucketCount = hourly && endDay === generatedAt.slice(0, 10)
        ? new Date(generatedAt).getUTCHours() + 1 : (end - start) / step;
    const daily = Array.from({ length: bucketCount }, (_, index) => {
        const iso = new Date(start + index * step).toISOString();
        const day = hourly ? iso.slice(0, 13).replace('T', ' ') + ':00' : iso.slice(0, 10);
        return { day, ...Object.fromEntries(metrics.map(([key], i) => [key, counts[i].get(day) ?? 0])) };
    });
    return c.json({ generatedAt, from: startDay, to: endDay, domain, interval: hourly ? 'hour' : 'day', daily },
        200, { 'Cache-Control': 'private, no-store' });
};

export default { get };
