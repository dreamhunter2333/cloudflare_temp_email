import { Context } from "hono";
import { getSetting, saveSetting } from "../utils";

const CONFIG_KEY_PREFIX = "admin-config:";
const CONFIG_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

const getStorageKey = (key: string) => `${CONFIG_KEY_PREFIX}${key}`;

export default {
    get: async (c: Context<HonoCustomType>) => {
        const key = c.req.param("key");
        if (!CONFIG_KEY_PATTERN.test(key)) {
            return c.text("Invalid config key", 400);
        }

        const value = await getSetting(c, getStorageKey(key));
        return c.json({ key, value });
    },
    save: async (c: Context<HonoCustomType>) => {
        const { key, value } = await c.req.json<{ key?: unknown, value?: unknown }>();
        if (typeof key !== "string" || !CONFIG_KEY_PATTERN.test(key)) {
            return c.text("Invalid config key", 400);
        }
        if (typeof value !== "string") {
            return c.text("Config value must be a string", 400);
        }

        await saveSetting(c, getStorageKey(key), value);
        return c.json({ success: true, key, value });
    },
}
