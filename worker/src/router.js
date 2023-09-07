import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'

const api = new Hono()

api.get('/api/mails', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { results } = await c.env.DB.prepare(
        `SELECT id, source, subject, message FROM mails where address = ? order by id desc limit 10`
    ).bind(address).all();
    return c.json(results);
})

api.get('/api/settings', async (c) => {
    return c.json(c.get("jwtPayload"));
})

api.get('/open_api/settings', async (c) => {
    return c.json({
        "prefix": c.env.PREFIX,
        "domain": c.env.DOMAIN,
    });
})

api.get('/api/new_address', async (c) => {
    // insert new address
    let { name } = await c.req.query();
    if (!name) {
        name = Math.random().toString(36).substring(2, 15)
    }
    try {
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address (name) VALUES (?)`
        ).bind(name).run();
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
        address: c.env.PREFIX + name + "@" + c.env.DOMAIN
    }, c.env.JWT_SECRET)
    return c.json({
        jwt: jwt
    })
})

export { api }
