import { Context } from "hono";
import { HonoCustomType } from "../types";
import { CONSTANTS } from "../constants";
import { AdminWebhookSettings, WebhookSettings } from "../models";
import { getBooleanValue } from "../utils";
import { commonParseMail, sendWebhook } from "../common";


async function getWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const { address } = c.get("jwtPayload")
    const adminSettings = await c.env.KV.get<AdminWebhookSettings>(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, "json");
    if (!adminSettings?.allowList.includes(address)) {
        return c.text("Webhook settings is not allowed for this user", 403);
    }
    const settings = await c.env.KV.get<WebhookSettings>(
        `${CONSTANTS.WEBHOOK_KV_USER_SETTINGS_KEY}:${address}`, "json"
    ) || new WebhookSettings();
    return c.json(settings);
}


async function saveWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const { address } = c.get("jwtPayload")
    const adminSettings = await c.env.KV.get<AdminWebhookSettings>(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, "json");
    if (!adminSettings?.allowList.includes(address)) {
        return c.text("Webhook settings is not allowed for this user", 403);
    }
    const settings = await c.req.json<WebhookSettings>();
    await c.env.KV.put(
        `${CONSTANTS.WEBHOOK_KV_USER_SETTINGS_KEY}:${address}`,
        JSON.stringify(settings));
    return c.json({ success: true })
}

async function testWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<WebhookSettings>();
    const { address } = c.get("jwtPayload");
    // random raw email
    const { id: mailId, raw } = await c.env.DB.prepare(
        `SELECT id, raw FROM raw_mails WHERE address = ? ORDER BY RANDOM() LIMIT 1`
    ).bind(address).first<{ id: string, raw: string }>() || {};

    const parsedEmail = await commonParseMail(raw);
    const res = await sendWebhook(settings, {
        id: mailId || "0",
        url: c.env.FRONTEND_URL ? `${c.env.FRONTEND_URL}?mail_id=${mailId}` : "",
        from: parsedEmail?.sender || "test@test.com",
        to: address,
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
