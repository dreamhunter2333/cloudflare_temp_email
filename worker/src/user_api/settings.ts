import { Context } from "hono";

import i18n from "../i18n";
import { UserOauth2Settings, UserSettings } from "../models";
import { getJsonSetting, getUserRoles } from "../utils"
import { CONSTANTS } from "../constants";
import { commonGetUserRole } from "../common";
import { Jwt } from "hono/utils/jwt";

export default {
    openSettings: async (c: Context<HonoCustomType>) => {
        const value = await getJsonSetting(c, CONSTANTS.USER_SETTINGS_KEY);
        const settings = new UserSettings(value);
        const oauth2ClientIDs = [] as { clientID: string, name: string, icon?: string }[];
        try {
            const oauth2Settings = await getJsonSetting<UserOauth2Settings[]>(c, CONSTANTS.OAUTH2_SETTINGS_KEY);
            oauth2ClientIDs.push(
                ...oauth2Settings?.map(s => ({
                    clientID: s.clientID,
                    name: s.name,
                    icon: s.icon,
                })) || []
            );
        } catch (e) {
            console.error("Failed to get oauth2 settings", e);
        }
        return c.json({
            enable: settings.enable,
            enableMailVerify: settings.enableMailVerify,
            oauth2ClientIDs: oauth2ClientIDs,
        })
    },
    settings: async (c: Context<HonoCustomType>) => {
        const user = c.get("userPayload");
        const msgs = i18n.getMessagesbyContext(c);
        // check if user exists
        const db_user_id = await c.env.DB.prepare(
            `SELECT id FROM users where id = ?`
        ).bind(user.user_id).first<number | undefined | null>("id");
        if (!db_user_id) {
            return c.text(msgs.UserNotFoundMsg, 400);
        }
        const user_role = await commonGetUserRole(c, db_user_id);
        const is_admin = (
            c.env.ADMIN_USER_ROLE
            &&
            c.env.ADMIN_USER_ROLE === user_role?.role
        );
        const access_token = user_role?.role ? await Jwt.sign({
            user_email: user.user_email,
            user_id: user.user_id,
            user_role: user_role.role,
            iat: Math.floor(Date.now() / 1000),
            // 1 hour
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, c.env.JWT_SECRET, "HS256") : null;
        // create new if expired in 7 days
        const new_user_token = user.exp > (
            Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        ) ? null : await Jwt.sign({
            user_email: user.user_email,
            user_id: user.user_id,
            // 30 days expire in seconds
            exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256");
        // update address updated_at asynchronously
        c.executionCtx.waitUntil((async () => {
            try {
                await c.env.DB.prepare(
                    `UPDATE address SET updated_at = datetime('now') where id IN `
                    + `(SELECT address_id FROM users_address WHERE user_id = ?)`
                ).bind(user.user_id).run();
            } catch (e) {
                console.warn("[user_api/settings] updateAddressUpdatedAt failed:", user.user_id, e);
            }
        })());
        return c.json({
            ...user,
            is_admin: is_admin,
            access_token: access_token,
            new_user_token: new_user_token,
            user_role: user_role
        });
    },
}
