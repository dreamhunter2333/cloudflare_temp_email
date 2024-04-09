import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";

async function email(message, env, ctx) {
    if (env.BLACK_LIST && env.BLACK_LIST.split(",").some(word => message.from.includes(word))) {
        message.setReject("Missing from address");
        console.log(`Reject message from ${message.from} to ${message.to}`);
        return;
    }
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
        const message_id = message.headers.get("Message-ID");

        // save email
        const { success } = await env.DB.prepare(
            `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
        ).bind(
            message.from, message.to, rawEmail, message_id
        ).run();
        if (!success) {
            message.setReject(`Failed save message to ${message.to}`);
            console.log(`Failed save message from ${message.from} to ${message.to}`);
        }

        // auto reply email
        try {
            const results = await env.DB.prepare(
                `SELECT * FROM auto_reply_mails where address = ? and enabled = 1`
            ).bind(message.to).first();
            if (results && results.source_prefix && message.from.startsWith(results.source_prefix)) {
                const msg = createMimeMessage();
                msg.setHeader("In-Reply-To", message.headers.get("Message-ID"));
                msg.setSender({
                    name: results.name || results.address,
                    addr: results.address
                });
                msg.setRecipient(message.from);
                msg.setSubject(results.subject || "Auto-reply");
                msg.addMessage({
                    contentType: 'text/plain',
                    data: results.message || "This is an auto-reply message, please reconact later."
                });

                const replyMessage = new EmailMessage(
                    message.to,
                    message.from,
                    msg.asRaw()
                );
                await message.reply(replyMessage);
            }
        } catch (error) {
            console.log("reply email error", error);
        }
    } else {
        message.setReject(`Unknown address ${message.to}`);
        console.log(`Unknown address ${message.to}`);
    }
}

export { email }
