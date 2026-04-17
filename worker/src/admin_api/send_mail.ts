import { Context } from "hono";
import i18n from "../i18n";
import { sendMail } from "../mails_api/send_mail_api";
import { ensureSendMailLimit, increaseSendMailLimitCount } from "../mails_api/send_mail_limit_utils";

const getAdminSendMailErrorMessage = (
    msgs: ReturnType<typeof i18n.getMessagesbyContext>,
    error: unknown
): string => {
    const message = error instanceof Error ? error.message : "";
    return Object.values(msgs).includes(message)
        ? message
        : msgs.OperationFailedMsg;
}

export const sendMailbyAdmin = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    let reqJson;
    try {
        reqJson = await c.req.json();
    } catch (e) {
        console.error("Admin send_mail invalid json", e);
        return c.text(msgs.InvalidInputMsg, 400)
    }
    const {
        from_name, from_mail,
        to_mail, to_name,
        subject, content, is_html
    } = reqJson;
    try {
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
    } catch (e) {
        console.error("Admin send_mail failed", e);
        return c.text(getAdminSendMailErrorMessage(msgs, e), 400)
    }
    return c.json({ status: "ok" });
}

export const sendMailByBindingAdmin = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!c.env.SEND_MAIL) {
        return c.text(msgs.EnableSendMailMsg, 400)
    }
    let reqJson;
    try {
        reqJson = await c.req.json();
    } catch (e) {
        console.error("Admin raw send_mail invalid json", e);
        return c.text(msgs.InvalidInputMsg, 400)
    }
    const {
        from, to, subject,
        html, text,
        cc, bcc, replyTo,
        attachments, headers,
    } = reqJson;
    if (!from || !to || !subject || (!html && !text)) {
        return c.text(msgs.InvalidInputMsg, 400)
    }
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
        return c.text(getAdminSendMailErrorMessage(msgs, e), 400)
    }
    return c.json({ status: "ok" });
}
