import { Context } from "hono";

import { HonoCustomType } from "../types";
import { UserSettings } from "../models";
import { getJsonSetting, getUserRoles } from "../utils"
import { CONSTANTS } from "../constants";
import { commonGetUserRole } from "../common";

export default {
    openSettings: async (c: Context<HonoCustomType>) => {
        const value = await getJsonSetting(c, CONSTANTS.USER_SETTINGS_KEY);
        const settings = new UserSettings(value);
        return c.json({
            enable: settings.enable,
            enableMailVerify: settings.enableMailVerify,
        })
    },
    settings: async (c: Context<HonoCustomType>) => {
        const user = c.get("userPayload");
        // check if user exists
        const db_user_id = await c.env.DB.prepare(
            `SELECT id FROM users where id = ?`
        ).bind(user.user_id).first<number | undefined | null>("id");
        if (!db_user_id) {
            return c.text("User not found", 400);
        }
        const user_role = await commonGetUserRole(c, db_user_id);
        return c.json({
            ...user,
            user_role: user_role
        });
    },
}
