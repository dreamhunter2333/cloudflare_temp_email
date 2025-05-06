import { Context } from "hono";
import { CONSTANTS } from "../constants";

export class TelegramSettings {
    enableAllowList: boolean;
    allowList: string[];
    miniAppUrl: string;
    enableGlobalMailPush: boolean;
    globalMailPushList: string[];

    constructor(
        enableAllowList: boolean, allowList: string[], miniAppUrl: string,
        enableGlobalMailPush: boolean, globalMailPushList: string[]
    ) {
        this.enableAllowList = enableAllowList;
        this.allowList = allowList;
        this.miniAppUrl = miniAppUrl;
        this.enableGlobalMailPush = enableGlobalMailPush;
        this.globalMailPushList = globalMailPushList;
    }
}

async function getTelegramSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
    return c.json(settings || new TelegramSettings(false, [], "", false, []));
}


async function saveTelegramSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<TelegramSettings>();
    await c.env.KV.put(CONSTANTS.TG_KV_SETTINGS_KEY, JSON.stringify(settings));
    return c.json({ success: true })
}

export default {
    getTelegramSettings,
    saveTelegramSettings,
}
