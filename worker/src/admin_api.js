import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'
import { getSendbox } from './send_mail_api'
import { sendAdminInternalMail } from './utils'

const api = new Hono()

api.get('/admin/address', async (c) => {
    const { limit, offset, query } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    if (query) {
        const { results } = await c.env.DB.prepare(
            `SELECT a.*,`
            + ` (SELECT COUNT(*) FROM raw_mails WHERE address = a.name) AS mail_count,`
            + ` (SELECT COUNT(*) FROM sendbox WHERE address = a.name) AS send_count`
            + ` FROM address a`
            + ` where name like ?`
            + ` order by id desc limit ? offset ?`
        ).bind(`%${query}%`, limit, offset).all();
        let count = 0;
        if (offset == 0) {
            const { count: addressCount } = await c.env.DB.prepare(
                `SELECT count(*) as count FROM address where name like ?`
            ).bind(`%${query}%`).first();
            count = addressCount;
        }
        return c.json({
            results: results,
            count: count
        })
    }
    const { results } = await c.env.DB.prepare(
        `SELECT a.*,`
        + ` (SELECT COUNT(*) FROM raw_mails WHERE address = a.name) AS mail_count,`
        + ` (SELECT COUNT(*) FROM sendbox WHERE address = a.name) AS send_count`
        + ` FROM address a`
        + ` order by id desc limit ? offset ?`
    ).bind(limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: addressCount } = await c.env.DB.prepare(
            `SELECT count(*) as count FROM address`
        ).first();
        count = addressCount;
    }
    return c.json({
        results: results,
        count: count
    })
})

api.delete('/admin/delete_address/:id', async (c) => {
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address WHERE id = ? `
    ).bind(id).run();
    if (!success) {
        return c.text("Failed to delete address", 500)
    }
    const { success: mailSuccess } = await c.env.DB.prepare(
        `DELETE FROM mails WHERE address IN
        (select name from address where id = ?) `
    ).bind(id).run();
    if (!mailSuccess) {
        return c.text("Failed to delete mails", 500)
    }
    const { success: sendAccess } = await c.env.DB.prepare(
        `DELETE FROM address_sender WHERE address_id = ? `
    ).bind(id).run();
    return c.json({
        success: success && mailSuccess && sendAccess
    })
})

api.get('/admin/show_password/:id', async (c) => {
    const { id } = c.req.param();
    const name = await c.env.DB.prepare(
        `SELECT name FROM address WHERE id = ? `
    ).bind(id).first("name");
    const jwt = await Jwt.sign({
        address: name,
        address_id: id
    }, c.env.JWT_SECRET)
    return c.json({
        password: jwt
    })
})


api.get('/admin/mails', async (c) => {
    const { address, limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    if (!address) {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM raw_mails order by id desc limit ? offset ?`
        ).bind(limit, offset).all();
        let count = 0;
        if (offset == 0) {
            const { count: mailCount } = await c.env.DB.prepare(
                `SELECT count(*) as count FROM raw_mails`
            ).first();
            count = mailCount;
        }
        return c.json({
            results: results,
            count: count
        })
    }
    const { results } = await c.env.DB.prepare(
        `SELECT * FROM raw_mails where address = ? order by id desc limit ? offset ?`
    ).bind(address, limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(
            `SELECT count(*) as count FROM raw_mails where address = ? `
        ).bind(address).first();
        count = mailCount;
    }
    return c.json({
        results: results,
        count: count
    })
});

api.get('/admin/mails_unknow', async (c) => {
    const { limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    const { results } = await c.env.DB.prepare(`
        SELECT * FROM raw_mails
        where address NOT IN (select name from address)
        order by id desc limit ? offset ? `
    ).bind(limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM raw_mails
            where address NOT IN
            (select name from address)`
        ).first();
        count = mailCount;
    }
    return c.json({
        results: results,
        count: count
    })
});

api.get('/admin/address_sender', async (c) => {
    const { address, limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    if (address) {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM address_sender where address = ? order by id desc limit ? offset ?`
        ).bind(address, limit, offset).all();
        let count = 0;
        if (offset == 0) {
            const { count: addressCount } = await c.env.DB.prepare(
                `SELECT count(*) as count FROM address_sender where address = ?`
            ).bind(address).first();
            count = addressCount;
        }
        return c.json({
            results: results,
            count: count
        })
    }
    const { results } = await c.env.DB.prepare(
        `SELECT * FROM address_sender order by id desc limit ? offset ? `
    ).bind(limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: addressCount } = await c.env.DB.prepare(
            `SELECT count(*) as count FROM address_sender`
        ).first();
        count = addressCount;
    }
    return c.json({
        results: results,
        count: count
    })
})

api.post('/admin/address_sender', async (c) => {
    let { address, address_id, balance, enabled } = await c.req.json();
    if (!address_id) {
        return c.text("Invalid address_id", 400)
    }
    enabled = enabled ? 1 : 0;
    const { success } = await c.env.DB.prepare(
        `UPDATE address_sender SET enabled = ?, balance = ? WHERE id = ? `
    ).bind(enabled, balance, address_id).run();
    if (!success) {
        return c.text("Failed to update address sender", 500)
    }
    await sendAdminInternalMail(
        c, address, "Account Send Access Updated",
        `You send access has been ${enabled ? "enabled" : "disabled"}, balance: ${balance}`
    );
    return c.json({
        success: success
    })
})

api.get('/admin/sendbox', async (c) => {
    const { address, limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    if (!address) {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM sendbox order by id desc limit ? offset ?`
        ).bind(limit, offset).all();
        let count = 0;
        if (offset == 0) {
            const { count: mailCount } = await c.env.DB.prepare(
                `SELECT count(*) as count FROM sendbox`
            ).first();
            count = mailCount;
        }
        return c.json({
            results: results,
            count: count
        })
    }
    const { results } = await c.env.DB.prepare(
        `SELECT * FROM sendbox where address = ? order by id desc limit ? offset ?`
    ).bind(address, limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(
            `SELECT count(*) as count FROM sendbox where address = ?`
        ).bind(address).first();
        count = mailCount;
    }
    return c.json({
        results: results,
        count: count
    })
})

api.get('/admin/statistics', async (c) => {
    const { count: mailCountV1 } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM mails`
    ).first();
    const { count: mailCount } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM raw_mails`
    ).first();
    const { count: addressCount } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM address`
    ).first();
    const { count: activeUserCount7days } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM address where updated_at > datetime('now', '-7 day')`
    ).first();
    const { count: sendMailCount } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM sendbox`
    ).first();
    return c.json({
        mailCount: (mailCountV1 || 0) + (mailCount || 0),
        userCount: addressCount,
        activeUserCount7days: activeUserCount7days,
        sendMailCount: sendMailCount
    })
});

api.post('/admin/cleanup', async (c) => {
    const { cleanType, cleanDays } = await c.req.json();
    if (!cleanType || !cleanDays || cleanDays < 0 || cleanDays > 30) {
        return c.text("Invalid cleanType or cleanDays", 400)
    }
    console.log(`Cleanup ${cleanType} before ${cleanDays} days`);
    switch (cleanType) {
        case "mails":
            await c.env.DB.prepare(`
                DELETE FROM raw_mails WHERE created_at < datetime('now', '-${cleanDays} day')`
            ).run();
            break;
        case "mails_unknow":
            await c.env.DB.prepare(`
                DELETE FROM raw_mails WHERE address NOT IN
                (select name from address) AND created_at < datetime('now', '-${cleanDays} day')`
            ).run();
            break;
        case "address":
            await c.env.DB.prepare(`
                DELETE FROM address WHERE updated_at < datetime('now', '-${cleanDays} day')`
            ).run();
            break;
        case "sendbox":
            await c.env.DB.prepare(`
                DELETE FROM sendbox WHERE created_at < datetime('now', '-${cleanDays} day')`
            ).run();
            break;
        default:
            return c.text("Invalid cleanType", 400)
    }
    return c.json({
        success: true
    })
})

export { api }
