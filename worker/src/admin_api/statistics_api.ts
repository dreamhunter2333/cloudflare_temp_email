import { Context } from 'hono'

const get = async (c: Context<HonoCustomType>) => {
    const { count: mailCount } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM raw_mails`
    ).first<{ count: number }>() || {};
    const { count: addressCount } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM address`
    ).first<{ count: number }>() || {};
    const { count: activeAddressCount7days } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM address where updated_at > datetime('now', '-7 day')`
    ).first<{ count: number }>() || {};
    const { count: activeAddressCount30days } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM address where updated_at > datetime('now', '-30 day')`
    ).first<{ count: number }>() || {};
    const { count: sendMailCount } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM sendbox`
    ).first<{ count: number }>() || {};
    const { count: userCount } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM users`
    ).first<{ count: number }>() || {};
    return c.json({
        mailCount,
        addressCount,
        activeAddressCount7days,
        activeAddressCount30days,
        userCount,
        sendMailCount,
    });
};

export default { get };
