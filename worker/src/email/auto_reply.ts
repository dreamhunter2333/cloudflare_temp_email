import { createMimeMessage } from "mimetext";
import { getBooleanValue } from "../utils";

/**
 * Check if the sender matches the source_prefix filter.
 * - empty/undefined: match all senders
 * - starts and ends with `/`: treat as regex (e.g. `/.*@example\.com$/`)
 * - otherwise: legacy startsWith match
 */
function matchSender(from: string, sourcePrefix: string | undefined): boolean {
    if (!sourcePrefix) return true;
    if (sourcePrefix.startsWith("/") && sourcePrefix.endsWith("/") && sourcePrefix.length > 2) {
        try {
            const regex = new RegExp(sourcePrefix.slice(1, -1));
            return regex.test(from);
        } catch {
            return false;
        }
    }
    return from.startsWith(sourcePrefix);
}

export const auto_reply = async (message: ForwardableEmailMessage, env: Bindings): Promise<void> => {
    const message_id = message.headers.get("Message-ID");
    // auto reply email
    if (getBooleanValue(env.ENABLE_AUTO_REPLY) && message_id) {
        try {
            const results = await env.DB.prepare(
                `SELECT * FROM auto_reply_mails where address = ? and enabled = 1`
            ).bind(message.to).first<Record<string, string>>();
            if (results && matchSender(message.from, results.source_prefix)) {
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
                if (getBooleanValue(env.E2E_TEST_MODE)) {
                    await message.reply(msg.asRaw());
                } else {
                    const { EmailMessage } = await import('cloudflare:email');
                    const replyMessage = new EmailMessage(
                        message.to,
                        message.from,
                        msg.asRaw()
                    );
                    // @ts-ignore
                    await message.reply(replyMessage);
                }
            }
        } catch (error) {
            console.log("reply email error", error);
        }
    }
}
