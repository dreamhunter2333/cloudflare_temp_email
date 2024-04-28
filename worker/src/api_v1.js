import { Hono } from 'hono'

// api v1 is deprecated
const api = new Hono()

api.get('/admin/v1/mails', async (c) => {
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

api.get('/admin/v1/mails_unknow', async (c) => {
    const { limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    const { results } = await c.env.DB.prepare(`
        SELECT id, source, subject, message FROM mails
        where address NOT IN(select name from address)
        order by id desc limit ? offset ? `
    ).bind(limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(`
            SELECT count(*) as count FROM mails
            where address NOT IN (select name from address)`
        ).first();
        count = mailCount;
    }
    return c.json({
        results: results,
        count: count
    })
});

api.get('/api/v1/mails', async (c) => {
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
        `SELECT id, source, subject, message, message_id, created_at FROM mails where address = ? order by id desc limit ? offset ?`
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

// attachments
api.get("/api/v1/attachment/:attachment_id", async (c) => {
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
