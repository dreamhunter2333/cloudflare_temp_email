import { Hono } from 'hono'

const api = new Hono()

api.post('/api/requset_send_mail_access', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.text("No address", 400)
    }
    try {
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address_sender (address, balance, enabled) VALUES (?, 1, 1)`
        ).bind(address).run();
        if (!success) {
            return c.text("Failed to request send mail access", 500)
        }
    } catch (e) {
        if (e.message && e.message.includes("UNIQUE")) {
            return c.text("Already requested", 400)
        }
        return c.text("Failed to request send mail access", 500)
    }
    return c.json({ status: "ok" })
})


api.post('/api/send_mail', async (c) => {
    const { address } = c.get("jwtPayload")
    // check permission
    const balance = await c.env.DB.prepare(
        `SELECT balance FROM address_sender
            where address = ? and enabled = 1`
    ).bind(address).first("balance");
    if (!balance || balance <= 0) {
        return c.text("No balance", 400);
    }
    let {
        from_name, to_mail, to_name,
        subject, content, is_html
    } = await c.req.json();
    if (!address) {
        return c.text("No address", 400)
    }
    if (!to_mail) {
        return c.text("Invalid to mail", 400)
    }
    from_name = from_name || address;
    to_name = to_name || to_mail;
    if (!subject) {
        return c.text("Invalid subject", 400)
    }
    if (!content) {
        return c.text("Invalid content", 400)
    }
    let dmikBody = {}
    if (c.env.DKIM_SELECTOR && c.env.DKIM_PRIVATE_KEY && address.includes("@")) {
        dmikBody = {
            "dkim_domain": address.split("@")[1],
            "dkim_selector": c.env.DKIM_SELECTOR,
            "dkim_private_key": c.env.DKIM_PRIVATE_KEY,
        }
    }
    const body = {
        "personalizations": [
            {
                "to": [{
                    "email": to_mail,
                    "name": to_name,
                }],
                ...dmikBody,
            }
        ],
        "from": {
            "email": address,
            "name": from_name,
        },
        "subject": subject,
        "content": [{
            "type": is_html ? "text/html" : "text/plain",
            "value": content,
        }],
    };
    let send_request = new Request("https://api.mailchannels.net/tx/v1/send", {
        "method": "POST",
        "headers": {
            "content-type": "application/json",
        },
        "body": JSON.stringify(body),
    });
    const resp = await fetch(send_request);
    const respText = await resp.text();
    console.log(resp.status + " " + resp.statusText + ": " + respText);
    if (resp.status >= 300) {
        return c.text("Failed to send mail", 500)
    }
    // update balance
    try {
        const { success } = await c.env.DB.prepare(
            `UPDATE address_sender SET balance = balance - 1
        where address = ?`
        ).bind(address).run();
        if (!success) {
            console.warn(`Failed to update balance for ${address}`);
        }
    } catch (e) {
        console.warn(`Failed to update balance for ${address}`);
    }
    // save to sendbox
    try {
        if (body?.personalizations?.[0]?.dkim_private_key) {
            delete body.personalizations[0].dkim_private_key;
        }
        const { success: success2 } = await c.env.DB.prepare(
            `INSERT INTO sendbox (address, raw) VALUES (?, ?)`
        ).bind(address, JSON.stringify(body)).run();
        if (!success2) {
            console.warn(`Failed to save to sendbox for ${address}`);
        }
    } catch (e) {
        console.warn(`Failed to save to sendbox for ${address}`);
    }
    return c.json({ status: "ok" });
})

const getSendbox = async (c, address, limit, offset) => {
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    const { results } = await c.env.DB.prepare(
        `SELECT * FROM sendbox where address = ?
         order by id desc limit ? offset ?`
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
}

api.get('/api/sendbox', async (c) => {
    const { address } = c.get("jwtPayload")
    const { limit, offset } = c.req.query();
    return getSendbox(c, address, limit, offset);
})

export { api, getSendbox }
