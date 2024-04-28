import { Jwt } from 'hono/utils/jwt'

import { getDomains } from './utils';

export const newAddress = async (c, name, domain, enablePrefix) => {
    // remove special characters
    name = name.replace(/[^a-zA-Z0-9.]/g, '')
    // check name length
    if (name.length < 0) {
        return c.text("Name too short", 400)
    }
    if (name.length > 100) {
        return c.text("Name too long (max 100)", 400)
    }
    // check domain, generate random domain
    const domains = getDomains(c);
    if (!domain || !domains.includes(domain)) {
        domain = domains[Math.floor(Math.random() * domains.length)];
    }
    // create address
    if (enablePrefix) {
        name = c.env.PREFIX + name + "@" + domain;
    } else {
        name = name + "@" + domain;
    }
    try {
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address(name) VALUES(?)`
        ).bind(name).run();
        if (!success) {
            return c.text("Failed to create address", 500)
        }
    } catch (e) {
        if (e.message && e.message.includes("UNIQUE")) {
            return c.text("Address already exists, please retry a new address", 400)
        }
        return c.text("Failed to create address", 500)
    }
    let address_id = 0;
    try {
        address_id = await c.env.DB.prepare(
            `SELECT id FROM address where name = ?`
        ).bind(name).first("id");
    } catch (error) {
        console.log(error);
    }
    // create jwt
    const jwt = await Jwt.sign({
        address: name,
        address_id: address_id
    }, c.env.JWT_SECRET)
    return c.json({
        jwt: jwt
    })
}
