import { Context } from "hono";
import { sendMail } from "../mails_api/send_mail_api";

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
