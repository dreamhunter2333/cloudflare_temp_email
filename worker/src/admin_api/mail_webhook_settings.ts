import { Context } from "hono";
import { HonoCustomType } from "../types";
import { CONSTANTS } from "../constants";
import { WebhookSettings } from "../models";
import { commonParseMail, sendWebhook } from "../common";

async function getWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.env.KV.get<WebhookSettings>(
        CONSTANTS.WEBHOOK_KV_ADMIN_MAIL_SETTINGS_KEY, "json"
    ) || new WebhookSettings();
    return c.json(settings);
}

async function saveWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<WebhookSettings>();
    await c.env.KV.put(
        CONSTANTS.WEBHOOK_KV_ADMIN_MAIL_SETTINGS_KEY,
        JSON.stringify(settings));
    return c.json({ success: true })
}

async function testWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<WebhookSettings>();
    // random raw email
    const raw = await c.env.DB.prepare(
        `SELECT raw FROM raw_mails ORDER BY RANDOM() LIMIT 1`
    ).first<string>("raw");

    const parsedEmail = await commonParseMail(raw);
    const res = await sendWebhook(settings, {
        from: parsedEmail?.sender || "test@test.com",
        to: "admin@test.com",
        subject: parsedEmail?.subject || "test subject",
        raw: raw || "test raw email",
        parsedText: parsedEmail?.text || "test parsed text",
        parsedHtml: parsedEmail?.html || "test parsed html"
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
