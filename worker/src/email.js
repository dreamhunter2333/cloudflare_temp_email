const PostalMime = require("postal-mime");

async function email(message, env, ctx) {
    if (!env.PREFIX || (message.to && message.to.startsWith(env.PREFIX))) {
        const reader = message.raw.getReader();
        const decoder = new TextDecoder("utf-8");
        let rawEmail = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            rawEmail += decoder.decode(value);
        }

        const parser = new PostalMime.default();
        const parsedEmail = await parser.parse(rawEmail);

        const { success } = await env.DB.prepare(
            `INSERT INTO mails (address, message) VALUES (?, ?)`
        ).bind(message.to, parsedEmail.html).run();
        if (!success) {
            message.setReject(`Failed save message to ${message.to}`);
        }
    } else {
        message.setReject(`Unknown address ${message.to}`);
    }
}

export { email }
