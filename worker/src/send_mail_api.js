import { Hono } from 'hono'

const api = new Hono()

api.post('/api/requset_send_mail_access', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.text("No address", 400)
    }
    try {
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address_sender (address, enabled) VALUES (?, 0)`
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
    const { count } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM address_sender where address = ? and enabled = 1`
    ).bind(address).first();
    if (count == 0) {
        return c.text("No permission", 403)
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
    let send_request = new Request("https://api.mailchannels.net/tx/v1/send", {
        "method": "POST",
        "headers": {
            "content-type": "application/json",
        },
        "body": JSON.stringify({
            "personalizations": [
                {
                    "to": [{
                        "email": to_mail,
                        "name": to_name,
                    }]
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
        }),
    });
    const resp = await fetch(send_request);
    const respText = await resp.text();
    console.log(resp.status + " " + resp.statusText + ": " + respText);
    if (resp.status >= 300) {
        return c.text("Failed to send mail", 500)
    }
    return c.json({ status: "ok" })
})

export { api }
