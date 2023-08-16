import { Hono } from 'hono'

const api = new Hono()

api.get('/api/mails', async (c) => {
    const { address } = c.req.query()
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { results } = await c.env.DB.prepare(
        `SELECT id, message FROM mails where address = ? order by id desc limit 10`
    ).bind(address).all();
    return c.json(results);
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
    return c.json({
        address: c.env.PREFIX + name + "@" + c.env.DOMAIN
    })
})

export { api }
