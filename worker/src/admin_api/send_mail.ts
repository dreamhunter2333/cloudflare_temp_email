import { Context } from "hono";
import i18n from "../i18n";
import { sendMail } from "../mails_api/send_mail_api";
import { ensureSendMailLimit, increaseSendMailLimitCount } from "../mails_api/send_mail_limit_utils";

export const sendMailbyAdmin = async (c: Context<HonoCustomType>) => {
    const {
        from_name, from_mail,
        to_mail, to_name,
        subject, content, is_html
    } = await c.req.json();
    await sendMail(c, from_mail, {
        from_name: from_name,
        to_name: to_name,
        to_mail: to_mail,
        subject: subject,
        content: content,
        is_html: is_html,
    }, {
        isAdmin: true
    })
    return c.json({ status: "ok" });
}

export const sendMailByBindingAdmin = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!c.env.SEND_MAIL) {
        return c.text(msgs.EnableSendMailMsg, 400)
    }
    const {
        from, to, subject,
        html, text,
        cc, bcc, replyTo,
        attachments, headers,
    } = await c.req.json();
    try {
        await ensureSendMailLimit(c);
        await c.env.SEND_MAIL.send({
            from,
            to,
            subject,
            ...(html ? { html } : {}),
            ...(text ? { text } : {}),
            ...(cc ? { cc } : {}),
            ...(bcc ? { bcc } : {}),
            ...(replyTo ? { replyTo } : {}),
            ...(attachments && attachments.length ? { attachments } : {}),
            ...(headers ? { headers } : {}),
        });
        await increaseSendMailLimitCount(c);
    } catch (e) {
        console.error("Admin raw send_mail failed", e);
        return c.text(msgs.OperationFailedMsg, 400)
    }
    return c.json({ status: "ok" });
}
