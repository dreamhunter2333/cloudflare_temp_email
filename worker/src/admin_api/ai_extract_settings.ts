import { Context } from "hono";
import { CONSTANTS } from "../constants";
import { getJsonSetting, saveSetting } from "../utils";

export type AiExtractSettings = {
    enableAllowList: boolean;
    allowList: string[];
}

async function getAiExtractSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await getJsonSetting<AiExtractSettings>(c, CONSTANTS.AI_EXTRACT_SETTINGS_KEY) || {
        enableAllowList: false,
        allowList: []
    };
    return c.json(settings);
}

async function saveAiExtractSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<AiExtractSettings>();
    await saveSetting(c, CONSTANTS.AI_EXTRACT_SETTINGS_KEY, JSON.stringify(settings));
    return c.json({ success: true })
}

export default {
    getAiExtractSettings,
    saveAiExtractSettings,
}
