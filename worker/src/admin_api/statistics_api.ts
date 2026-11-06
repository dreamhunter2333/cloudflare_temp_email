import type { Context } from 'hono'
import { getDomains } from '../utils'
import i18n from '../i18n'
import { getStatisticsSnapshot } from './statistics_cache'

const DAY = 86400000;
const metrics = [
    ['mailCount', 'raw_mails', 'address'],
    ['addressCount', 'address', 'name'],
    ['userCount', 'users', null],
    ['sendMailCount', 'sendbox', 'address'],
] as const;
type CountRow = { day?: string; domain: string | null; count: number };

const getTotals = (c: Context<HonoCustomType>, domainBreakdown = false) => getStatisticsSnapshot(c, domainBreakdown ? 'domain-totals' : 'totals', async () => {
    const results = await c.env.DB.batch<CountRow>(metrics.map(([, table, column]) => c.env.DB.prepare(
        column && domainBreakdown
            ? `SELECT lower(substr(${column}, instr(${column}, '@') + 1)) AS domain, count(*) AS count FROM ${table} GROUP BY domain`
            : `SELECT NULL AS domain, count(*) AS count FROM ${table}`
    )));
    return { generatedAt: new Date().toISOString(), rows: results.map(result => result.results) };
});

const get = async (c: Context<HonoCustomType>) => {
    const today = new Date().toISOString().slice(0, 10);
    const { from, to, domain: domainQuery, view } = c.req.query();
    const domain = domainQuery?.trim().toLowerCase() || '';
    const msgs = i18n.getMessagesbyContext(c);
    if (domain && !getDomains(c).includes(domain)) return c.text(msgs.InvalidStatisticsDomainMsg, 400);
    const selectTotals = (rows: CountRow[][]) => Object.fromEntries(metrics.map(([key, , column], i) => [key,
        rows[i].reduce((sum, row) => sum + (!domain || !column || row.domain === domain ? row.count : 0), 0),
    ]));
    if (view === 'totals') {
        const snapshot = await getTotals(c, !!domain);
        return c.json({ generatedAt: snapshot.generatedAt, domain, ...selectTotals(snapshot.rows) }, 200, { 'Cache-Control': 'private, no-store' });
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
    const legacy = !from && !to && !domain;
    const hourly = end - start === DAY && !legacy;
    const snapshot = await getStatisticsSnapshot(c, `trends:${startDay}:${endDay}:${hourly ? 'hour' : 'day'}`, async () => {
        const bucket = hourly ? "strftime('%Y-%m-%d %H:00', created_at)" : 'date(created_at)';
        const results = await c.env.DB.batch<CountRow>(metrics.map(([, table, column]) => c.env.DB.prepare(
            `SELECT ${bucket} AS day, ${column ? `lower(substr(${column}, instr(${column}, '@') + 1))` : 'NULL'} AS domain,
             count(*) AS count FROM ${table} WHERE created_at >= ? AND created_at < ? GROUP BY day, domain`
        ).bind(`${startDay} 00:00:00`, `${new Date(end).toISOString().slice(0, 10)} 00:00:00`)));
        return { generatedAt: new Date().toISOString(), rows: results.map(result => result.results) };
    });
    const counts = metrics.map(([, , column], i) => {
        const buckets = new Map<string, number>();
        for (const row of snapshot.rows[i]) {
            if (domain && column && row.domain !== domain) continue;
            if (row.day) buckets.set(row.day, (buckets.get(row.day) || 0) + row.count);
        }
        return buckets;
    });
    const step = hourly ? DAY / 24 : DAY;
    const bucketCount = hourly && endDay === today ? new Date(snapshot.generatedAt).getUTCHours() + 1 : (end - start) / step;
    const daily = Array.from({ length: bucketCount }, (_, index) => {
        const iso = new Date(start + index * step).toISOString();
        const day = hourly ? iso.slice(0, 13).replace('T', ' ') + ':00' : iso.slice(0, 10);
        return { day, ...Object.fromEntries(metrics.map(([key], i) => [key, counts[i].get(day) ?? 0])) };
    });
    const response = { generatedAt: snapshot.generatedAt, from: startDay, to: endDay, domain, interval: hourly ? 'hour' : 'day', daily };
    if (!legacy) return c.json(response, 200, { 'Cache-Control': 'private, no-store' });
    const [totals, activity] = await Promise.all([
        getTotals(c),
        getStatisticsSnapshot(c, 'activity', async () => await c.env.DB.prepare(
            `SELECT count(*) AS active30, coalesce(sum(updated_at > datetime('now', '-7 days')), 0) AS active7
             FROM address WHERE updated_at > datetime('now', '-30 days')`
        ).first<{ active7: number; active30: number }>()),
    ]);
    return c.json({ ...response, ...selectTotals(totals.rows),
        activeAddressCount7days: activity?.active7 ?? 0, activeAddressCount30days: activity?.active30 ?? 0,
    }, 200, { 'Cache-Control': 'private, no-store' });
};

export default { get };
