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

export { api }
