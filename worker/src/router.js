import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'

const api = new Hono()

api.get('/api/mails', async (c) => {
    const { address } = c.req.query()
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { results } = await c.env.DB.prepare(
        `SELECT id, source, message FROM mails where address = ? order by id desc limit 10`
    ).bind(address).all();
    return c.json(results);
})

api.get('/api/settings', async (c) => {
    return c.json(c.get("jwtPayload"));
})

api.get('/api/new_address', async (c) => {
    // insert new address
    const name = Math.random().toString(36).substring(2, 15)
    const { success } = await c.env.DB.prepare(
        `INSERT INTO address (name) VALUES (?)`
    ).bind(name).run();
    if (!success) {
        return c.json({ "error": "Failed to create address" }, 500)
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
