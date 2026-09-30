import { Context } from "hono";
import { CONSTANTS } from "../constants";
import { WebhookSettings } from "../models";
import { sendWebhook } from "../common";
import i18n from "../i18n";
import { getWebhookAttachments } from '../utils/webhook';
import { compileWebhookFilter } from '../utils/webhook_filter';
import { prepareWebhookTest, checkWebhookFilter } from '../utils/webhook_test';

async function getWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.env.KV.get<WebhookSettings>(
        CONSTANTS.WEBHOOK_KV_ADMIN_MAIL_SETTINGS_KEY, "json"
    ) || new WebhookSettings();
    return c.json(settings);
}

async function saveWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<WebhookSettings>().catch(() => null);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return c.text(i18n.getMessagesbyContext(c).InvalidRequestBodyMsg, 400);
    }
    try {
        compileWebhookFilter(settings.filter);
    } catch (error) {
        return c.text(`${i18n.getMessagesbyContext(c).InvalidWebhookFilterMsg}: ${(error as Error).message}`, 400);
    }
    await c.env.KV.put(
        CONSTANTS.WEBHOOK_KV_ADMIN_MAIL_SETTINGS_KEY,
        JSON.stringify(settings));
    return c.json({ success: true })
}

async function testWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const result = await prepareWebhookTest(c);
    if (result instanceof Response) return result;
    const { settings, mailRow, raw, parsedEmail, matched } = result;
    if (!matched) return c.json({ success: true, matched, skipped: true });
    const mailId = mailRow?.id;
    const res = await sendWebhook(settings, {
        attachments: await getWebhookAttachments(c.env, mailRow, parsedEmail?.attachments),
        id: mailId || "0",
        url: c.env.FRONTEND_URL ? `${c.env.FRONTEND_URL}?mail_id=${mailId}` : "",
        from: parsedEmail?.sender || "test@test.com",
        to: mailRow?.address || "admin@test.com",
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
    checkWebhookFilter: (c: Context<HonoCustomType>) => checkWebhookFilter(c),
}
