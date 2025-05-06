import { Context } from "hono";
import { CONSTANTS } from "../constants";
import { AdminWebhookSettings } from "../models";

async function getWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.env.KV.get<AdminWebhookSettings>(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, "json");
    return c.json(settings || new AdminWebhookSettings([]));
}

async function saveWebhookSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<AdminWebhookSettings>();
    await c.env.KV.put(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, JSON.stringify(settings));
    return c.json({ success: true })
}

export default {
    getWebhookSettings,
    saveWebhookSettings,
}
