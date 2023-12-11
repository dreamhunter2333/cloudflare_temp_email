import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'

const api = new Hono()

api.get('/api/mails_count', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { count } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM mails where address = ?`
    ).bind(address).first();
    return c.json({
        count: count
    })
})

api.get('/api/mails', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    const { results } = await c.env.DB.prepare(
        `SELECT id, source, subject, message FROM mails where address = ? order by id desc limit ? offset ?`
    ).bind(address, limit, offset).all();
    return c.json(results);
})

api.get('/api/settings', async (c) => {
    return c.json(c.get("jwtPayload"));
})

api.get('/open_api/settings', async (c) => {
    // check header x-custom-auth
    let needAuth = false;
    if (c.env.PASSWORDS && c.env.PASSWORDS.length > 0) {
        const auth = c.req.headers.get("x-custom-auth");
        needAuth = !c.env.PASSWORDS.includes(auth);
    }
    return c.json({
        "prefix": c.env.PREFIX,
        "domains": c.env.DOMAINS,
        "needAuth": needAuth,
    });
})

api.get('/api/new_address', async (c) => {
    let { name, domain } = await c.req.query();
    // if no name, generate random name
    if (!name) {
        name = Math.random().toString(36).substring(2, 15);
    }
    // check domain, generate random domain
    if (!domain || !c.env.DOMAINS.includes(domain)) {
        domain = c.env.DOMAINS[Math.floor(Math.random() * c.env.DOMAINS.length)];
    }
    // create address
    const emailAddress = c.env.PREFIX + name + "@" + domain
    try {
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address (name) VALUES (?)`
        ).bind(name + "@" + domain).run();
        if (!success) {
            return c.text("Failed to create address", 500)
        }
    } catch (e) {
        if (e.message && e.message.includes("UNIQUE")) {
            return c.text("Please retry a new address", 400)
        }
        return c.text("Failed to create address", 500)
    }
    // create jwt
    const jwt = await Jwt.sign({
        address: emailAddress
    }, c.env.JWT_SECRET)
    return c.json({
        jwt: jwt
    })
})

api.get('/admin/address_count', async (c) => {
    const { count } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM address`
    ).first();
    return c.json({
        count: count
    })
})

api.get('/admin/address', async (c) => {
    const { limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    const { results } = await c.env.DB.prepare(
        `SELECT * FROM address order by id desc limit ? offset ?`
    ).bind(limit, offset).all();
    return c.json(results.map((r) => {
        r.name = c.env.PREFIX + r.name;
        return r;
    }));
})

api.delete('/admin/delete_address/:id', async (c) => {
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address WHERE id = ?`
    ).bind(id).run();
    if (!success) {
        return c.text("Failed to delete address", 500)
    }
    return c.json({
        success: success
    })
})

api.get('/admin/show_password/:id', async (c) => {
    const { id } = c.req.param();
    const name = await c.env.DB.prepare(
        `SELECT name FROM address WHERE id = ?`
    ).bind(id).first("name");
    // compute address
    const emailAddress = c.env.PREFIX + name
    const jwt = await Jwt.sign({
        address: emailAddress
    }, c.env.JWT_SECRET)
    return c.json({
        password: jwt
    })
})

api.get('/admin/mails_count', async (c) => {
    const { address } = c.req.query();
    if (!address) {
        return c.text("Invalid address", 400)
    }
    const { count } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM mails where address = ?`
    ).bind(address).first();
    return c.json({
        count: count
    })
})

api.get('/admin/mails', async (c) => {
    const { address, limit, offset } = c.req.query();
    console.log(address, limit, offset)
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { results } = await c.env.DB.prepare(
        `SELECT id, source, subject, message FROM mails where address = ? order by id desc limit ? offset ?`
    ).bind(address, limit, offset).all();
    return c.json(results);
})

export { api }
