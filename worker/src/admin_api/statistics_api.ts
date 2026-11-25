import type { Context } from 'hono'
import i18n from '../i18n'

const get = async (c: Context<HonoCustomType>) => {
    const { from, to, granularity, includeTotals } = c.req.query();
    const legacy = from === undefined && to === undefined && granularity === undefined;
    if (!legacy) {
        const parseMidnight = (value = '') => {
            if (!/^\d{4}-\d{2}-\d{2} 00:00:00$/.test(value)) return NaN;
            const day = value.slice(0, 10);
            const timestamp = Date.parse(day);
            return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day ? timestamp : NaN;
        };
        const start = parseMidnight(from);
        const end = parseMidnight(to);
        const dayMs = 24 * 60 * 60 * 1000;
        if (!(start < end && end - start <= 30 * dayMs && end - dayMs <= Date.now())) {
            return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsRangeMsg, 400);
        }
        if (granularity !== 'day') {
            return c.text(i18n.getMessagesbyContext(c).InvalidStatisticsGranularityMsg, 400);
        }
    }

    const db = c.env.DB;
    const totalsQueries = legacy || includeTotals === 'true' ? [
        db.prepare('SELECT count(*) AS mailCount FROM raw_mails'),
        db.prepare(`SELECT count(*) AS addressCount,
            count(*) FILTER (WHERE updated_at > datetime('now', '-7 days')) AS activeAddressCount7days,
            count(*) FILTER (WHERE updated_at > datetime('now', '-30 days')) AS activeAddressCount30days
            FROM address`),
        db.prepare('SELECT count(*) AS sendMailCount FROM sendbox'),
        db.prepare(legacy ? 'SELECT count(*) AS userCount FROM users' :
            `SELECT count(*) AS userCount,
             count(*) FILTER (WHERE updated_at > datetime('now', '-7 days')) AS activeUserCount7days,
             count(*) FILTER (WHERE updated_at > datetime('now', '-30 days')) AS activeUserCount30days
             FROM users`),
    ] : [];

    const countByDay = (table: 'raw_mails' | 'address' | 'sendbox') => db.prepare(
        `WITH RECURSIVE time_ranges(start_time, end_time) AS (
            SELECT ?, datetime(?, '+1 day')
            UNION ALL
            SELECT end_time, datetime(end_time, '+1 day') FROM time_ranges WHERE end_time < ?
         )
         SELECT date(start_time) AS day, (
            SELECT count(*) FROM ${table}
            WHERE created_at >= time_ranges.start_time AND created_at < time_ranges.end_time
         ) AS count FROM time_ranges`
    ).bind(from, from, to);
    const trendQueries = legacy ? [] : [
        countByDay('raw_mails'),
        countByDay('address'),
        db.prepare(`SELECT date(created_at) AS day, count(*) AS count
            FROM users WHERE created_at >= ? AND created_at < ? GROUP BY day`).bind(from, to),
        countByDay('sendbox'),
    ];

    const results = await db.batch([...totalsQueries, ...trendQueries]);
    const totals = totalsQueries.length ? Object.assign({}, ...results.slice(0, totalsQueries.length).map(result => result.results[0])) : undefined;
    const [mail, addresses, users, sent] = results.slice(totalsQueries.length);
    return c.json(legacy ? totals : {
        totals,
        trends: { mailCount: mail.results, addressCount: addresses.results, userCount: users.results, sendMailCount: sent.results },
    }, 200, { 'Cache-Control': 'private, no-store' });
};

export default { get };
