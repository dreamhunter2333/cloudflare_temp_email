import { Context } from "hono";
import { CONSTANTS } from "../constants";
import { AdminWebhookSettings, WebhookSettings, RawMailRow } from "../models";
import { commonParseMail, sendWebhook } from "../common";
import { resolveRawEmail } from "../gzip";
import { getWebhookAttachments } from '../utils/webhook';
import { compileWebhookFilter } from '../utils/webhook_filter';
import i18n from "../i18n";


async function getWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const msgs = i18n.getMessagesbyContext(c);
    const { address } = c.get("jwtPayload")
    const adminSettings = await c.env.KV.get<AdminWebhookSettings>(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, "json");
    if (adminSettings?.enableAllowList && !adminSettings?.allowList.includes(address)) {
        return c.text(msgs.WebhookNotAllowedForUserMsg, 403);
    }
    const settings = await c.env.KV.get<WebhookSettings>(
        `${CONSTANTS.WEBHOOK_KV_USER_SETTINGS_KEY}:${address}`, "json"
    ) || new WebhookSettings();
    return c.json(settings);
}


async function saveWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const msgs = i18n.getMessagesbyContext(c);
    const { address } = c.get("jwtPayload")
    const adminSettings = await c.env.KV.get<AdminWebhookSettings>(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, "json");
    if (adminSettings?.enableAllowList && !adminSettings?.allowList.includes(address)) {
        return c.text(msgs.WebhookNotAllowedForUserMsg, 403);
    }
    const settings = await c.req.json<WebhookSettings>().catch(() => null);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return c.text(msgs.InvalidRequestBodyMsg, 400);
    }
    try {
        compileWebhookFilter(settings.filter);
    } catch (error) {
        return c.text(`${msgs.InvalidWebhookFilterMsg}: ${(error as Error).message}`, 400);
    }
    await c.env.KV.put(
        `${CONSTANTS.WEBHOOK_KV_USER_SETTINGS_KEY}:${address}`,
        JSON.stringify(settings));
    return c.json({ success: true })
}

async function testWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const msgs = i18n.getMessagesbyContext(c);
    const settings = await c.req.json<WebhookSettings & { mail_id?: number; check_only?: boolean }>().catch(() => null);
    if (!settings || typeof settings !== "object" || Array.isArray(settings)
        || (settings.check_only !== undefined && typeof settings.check_only !== 'boolean')) {
        return c.text(msgs.InvalidRequestBodyMsg, 400);
    }
    const requestedMailId = settings.mail_id;
    let match: ReturnType<typeof compileWebhookFilter>;
    try {
        match = compileWebhookFilter(settings.filter);
    } catch (error) {
        return c.text(`${msgs.InvalidWebhookFilterMsg}: ${(error as Error).message}`, 400);
    }
    if (requestedMailId !== undefined && (!Number.isSafeInteger(requestedMailId) || requestedMailId <= 0)) {
        return c.text(msgs.InvalidMailIdMsg, 400);
    }
    const { address } = c.get("jwtPayload");
    const mailRow = requestedMailId !== undefined ? await c.env.DB.prepare(
        `SELECT * FROM raw_mails WHERE id = ? AND address = ?`
    ).bind(requestedMailId, address).first<RawMailRow>() : await c.env.DB.prepare(
        `SELECT * FROM raw_mails WHERE address = ? ORDER BY RANDOM() LIMIT 1`
    ).bind(address).first<RawMailRow>();
    const mailId = mailRow?.id;
    if (!mailRow && (requestedMailId !== undefined || settings.filter != null || settings.check_only)) {
        return c.text(msgs.MailNotFoundMsg, 404);
    }
    const raw = mailRow ? await resolveRawEmail(mailRow) : "";
    const parsedEmailContext: ParsedEmailContext = { rawEmail: raw };
    const parsedEmail = await commonParseMail(parsedEmailContext);
    try {
        const matched = match(parsedEmail, mailRow?.source || '', address);
        if (!matched || settings.check_only) {
            return c.json({ success: true, matched, skipped: true });
        }
    } catch {
        return c.text(msgs.WebhookFilterEvaluationFailedMsg, 400);
    }
    const res = await sendWebhook(settings, {
        attachments: await getWebhookAttachments(c.env, mailRow, parsedEmail?.attachments),
        id: mailId || "0",
        url: c.env.FRONTEND_URL ? `${c.env.FRONTEND_URL}?mail_id=${mailId}` : "",
        from: parsedEmail?.sender || "test@test.com",
        to: address,
        subject: parsedEmail?.subject || "test subject",
        raw: raw || "test raw email",
        parsedText: parsedEmail?.text || "test parsed text",
        parsedHtml: parsedEmail?.html || "test parsed html",
        aiExtract: null,
        aiExtractType: "",
        aiExtractResult: "",
        aiExtractResultText: ""
    });
    if (!res.success) {
        return c.text(res.message || "send webhook error", 400);
    }
    return c.json({ success: true });
}

export default {
    getWebhookSettings,
    saveWebhookSettings,
    testWebhookSettings,
}
