import { Context } from "hono";
import { Bindings } from "../types";
import { CONSTANTS } from "../constants";

export class TelegramSettings {
    enableAllowList: boolean;
    allowList: string[];

    constructor(enableAllowList: boolean, allowList: string[]) {
        this.enableAllowList = enableAllowList;
        this.allowList = allowList;
    }
}

async function getTelegramSettings(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
    return c.json(settings || new TelegramSettings(false, []));
}


async function saveTelegramSettings(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    const settings = await c.req.json<TelegramSettings>();
    await c.env.KV.put(CONSTANTS.TG_KV_SETTINGS_KEY, JSON.stringify(settings));
    return c.json({ success: true })
}

export default {
    getTelegramSettings,
    saveTelegramSettings,
}
