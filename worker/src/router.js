import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'

const api = new Hono()

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
        `SELECT id, source, subject, message, message_id FROM mails where address = ? order by id desc limit ? offset ?`
    ).bind(address, limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(
            `SELECT count(*) as count FROM mails where address = ?`
        ).bind(address).first();
        count = mailCount;
    }
    // add attachments
    let attachmentResults = [];
    const message_ids = results.map((r) => r.message_id).filter((r) => r);
    console.log("message_ids", message_ids.map((id) => `'${id}'`).join(","));
    if (message_ids && message_ids.length > 0) {
        const { results: innerAttachmentResults } = await c.env.DB.prepare(
            `SELECT id, message_id FROM attachments where message_id in (${message_ids.map((id) => `'${id}'`).join(",")})`
        ).all();
        attachmentResults = innerAttachmentResults || [];
    }
    results.forEach((r) => {
        const attachment_id = attachmentResults.filter((ar) => ar.message_id == r.message_id).map((ar) => ar.id);
        if (attachment_id && attachment_id.length > 0) {
            r.attachment_id = attachment_id[0];
        }
        delete r.message_id;
    })
    return c.json({
        results: results,
        count: count
    })
})

api.get('/api/settings', async (c) => {
    const { address } = c.get("jwtPayload")
    const results = await c.env.DB.prepare(
        `SELECT * FROM auto_reply_mails where address = ? `
    ).bind(address).first();
    if (!results) {
        return c.json({
            auto_reply: {},
            address: address
        });
    }
    return c.json({
        auto_reply: {
            subject: results.subject,
            message: results.message,
            enabled: results.enabled == 1,
            source_prefix: results.source_prefix,
            name: results.name,
        },
        address: address
    });
})


api.post('/api/settings', async (c) => {
    const { address } = c.get("jwtPayload")
    const { auto_reply } = await c.req.json();
    const { name, subject, source_prefix, message, enabled } = auto_reply;
    if ((!subject || !message) && enabled) {
        return c.text("Invalid subject or message", 400)
    }
    else if (subject.length > 255 || message.length > 255) {
        return c.text("Subject or message too long", 400)
    }
    const { success } = await c.env.DB.prepare(
        `INSERT OR REPLACE INTO
        auto_reply_mails
                (name, address, source_prefix, subject, message, enabled)
        VALUES
                (?, ?, ?, ?, ?, ?)`
    ).bind(name || '', address, source_prefix || '', subject || '', message || '', enabled ? 1 : 0).run();
    if (!success) {
        return c.text("Failed to save settings", 500)
    }
    return c.json({
        success: success
    })
})

api.get('/open_api/settings', async (c) => {
    // check header x-custom-auth
    let needAuth = false;
    if (c.env.PASSWORDS && c.env.PASSWORDS.length > 0) {
        const auth = c.req.raw.headers.get("x-custom-auth");
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
            `INSERT INTO address(name) VALUES(?)`
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

api.get('/admin/address', async (c) => {
    const { limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
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
        address: emailAddress
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
        `SELECT id, source, subject, message FROM mails where address = ? order by id desc limit ? offset ? `
    ).bind(address, limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(
            `SELECT count(*) as count FROM mails where address = ? `
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
        SELECT id, source, subject, message FROM mails
        where address NOT IN(select concat('${c.env.PREFIX}', name) from address)
        order by id desc limit ? offset ? `
    ).bind(limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM mails
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

// attachments
api.get("/api/attachment/:attachment_id", async (c) => {
    const { attachment_id } = c.req.param();
    const { data } = await c.env.DB.prepare(
        `SELECT data FROM attachments where id = ? `
    ).bind(attachment_id).first();
    if (!data) {
        return c.text("Not found", 404)
    }
    return c.json(JSON.parse(data))
})

export { api }
