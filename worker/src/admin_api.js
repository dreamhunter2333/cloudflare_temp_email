import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'

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
            `SELECT * FROM address where concat('${c.env.PREFIX}', name) like ? order by id desc limit ? offset ? `
        ).bind(`%${query}%`, limit, offset).all();
        let count = 0;
        if (offset == 0) {
            const { count: addressCount } = await c.env.DB.prepare(
                `SELECT count(*) as count FROM address where concat('${c.env.PREFIX}', name) like ?`
            ).bind(`%${query}%`).first();
            count = addressCount;
        }
        return c.json({
            results: results.map((r) => {
                r.name = c.env.PREFIX + r.name;
                return r;
            }),
            count: count
        })
    }
    const { results } = await c.env.DB.prepare(
        `SELECT * FROM address order by id desc limit ? offset ? `
    ).bind(limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: addressCount } = await c.env.DB.prepare(
            `SELECT count(*) as count FROM address`
        ).first();
        count = addressCount;
    }
    return c.json({
        results: results.map((r) => {
            r.name = c.env.PREFIX + r.name;
            return r;
        }),
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
        (select concat('${c.env.PREFIX}', name) from address where id = ?) `
    ).bind(id).run();
    if (!mailSuccess) {
        return c.text("Failed to delete mails", 500)
    }
    return c.json({
        success: success
    })
})

api.get('/admin/show_password/:id', async (c) => {
    const { id } = c.req.param();
    const name = await c.env.DB.prepare(
        `SELECT name FROM address WHERE id = ? `
    ).bind(id).first("name");
    // compute address
    const emailAddress = c.env.PREFIX + name
    const jwt = await Jwt.sign({
        address: emailAddress,
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
    const { results } = await c.env.DB.prepare(
        `SELECT id, source, raw, created_at FROM raw_mails where address = ? order by id desc limit ? offset ?`
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
        SELECT id, source, raw, created_at FROM raw_mails
        where address NOT IN(select concat('${c.env.PREFIX}', name) from address)
        order by id desc limit ? offset ? `
    ).bind(limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM raw_mails
            where address NOT IN
            (select concat('${c.env.PREFIX}', name) from address)`
        ).first();
        count = mailCount;
    }
    return c.json({
        results: results,
        count: count
    })
});

api.get('/admin/address_sender', async (c) => {
    const { limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
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
    let { id: address_id, enabled } = await c.req.json();
    if (!address_id) {
        return c.text("Invalid address_id", 400)
    }
    enabled = enabled ? 1 : 0;
    const { success } = await c.env.DB.prepare(
        `UPDATE address_sender SET enabled = ? WHERE id = ? `
    ).bind(enabled, address_id).run();
    if (!success) {
        return c.text("Failed to update address sender", 500)
    }
    return c.json({
        success: success
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
    return c.json({
        mailCount: (mailCountV1 || 0) + (mailCount || 0),
        userCount: addressCount,
        activeUserCount7days: activeUserCount7days
    })
});

export { api }
