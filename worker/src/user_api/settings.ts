import { Context } from "hono";

import { HonoCustomType } from "../types";
import { UserSettings } from "../models";
import { getJsonSetting, getUserRoles } from "../utils"
import { CONSTANTS } from "../constants";
import { commonGetUserRole } from "../common";
import { Jwt } from "hono/utils/jwt";

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
        const is_admin = (
            c.env.ADMIN_USER_ROLE
            &&
            c.env.ADMIN_USER_ROLE === user_role?.role
        );
        const access_token = is_admin ? await Jwt.sign({
            user_email: user.user_email,
            user_id: user.user_id,
            user_role: user_role?.role,
            iat: Math.floor(Date.now() / 1000),
            // 1 hour
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, c.env.JWT_SECRET, "HS256") : null;
        return c.json({
            ...user,
            is_admin: is_admin,
            access_token: access_token,
            user_role: user_role
        });
    },
}
