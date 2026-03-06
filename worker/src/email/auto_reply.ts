import { createMimeMessage } from "mimetext";
import { getBooleanValue } from "../utils";

export const auto_reply = async (message: ForwardableEmailMessage, env: Bindings): Promise<void> => {
    const message_id = message.headers.get("Message-ID");
    // auto reply email
    if (getBooleanValue(env.ENABLE_AUTO_REPLY) && message_id) {
        try {
            const results = await env.DB.prepare(
                `SELECT * FROM auto_reply_mails where address = ? and enabled = 1`
            ).bind(message.to).first<Record<string, string>>();
            if (results && results.source_prefix && message.from.startsWith(results.source_prefix)) {
                const msg = createMimeMessage();
                msg.setHeader("In-Reply-To", message_id);
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
                const rawMime = msg.asRaw();
                let replyMessage: any;
                try {
                    const { EmailMessage } = await import('cloudflare:email');
                    replyMessage = new EmailMessage(message.to, message.from, rawMime);
                } catch {
                    // Fallback for environments without cloudflare:email (e.g. E2E tests)
                    replyMessage = {
                        from: message.to,
                        to: message.from,
                        raw: new ReadableStream({
                            start(ctrl) {
                                ctrl.enqueue(new TextEncoder().encode(rawMime));
                                ctrl.close();
                            }
                        })
                    };
                }
                // @ts-ignore
                await message.reply(replyMessage);
            }
        } catch (error) {
            console.log("reply email error", error);
        }
    }
}
