import { CONSTANTS } from '../constants';
import { getJsonSetting, saveSetting, checkUserPassword, getDomains } from '../utils';
import { UserSettings, GeoData, UserInfo } from "../models";

export default {
    getSetting: async (c) => {
        const value = await getJsonSetting(c, CONSTANTS.USER_SETTINGS_KEY);
        const settings = new UserSettings(value);
        return c.json(settings)
    },
    saveSetting: async (c) => {
        const value = await c.req.json();
        const settings = new UserSettings(value);
        if (settings.enableMailVerify && !c.env.KV) {
            return c.text("Please enable KV first if you want to enable mail verify", 403)
        }
        if (settings.enableMailVerify) {
            const mailDomain = settings.verifyMailSender.split("@")[1];
            const domains = getDomains(c);
            if (!domains.includes(mailDomain)) {
                return c.text(`VerifyMailSender(${settings.verifyMailSender}) domain must in ${JSON.stringify(domains, null, 2)}`, 400)
            }
        }
        if (settings.maxAddressCount < 0) {
            return c.text("Invalid maxAddressCount", 400)
        }
        await saveSetting(c, CONSTANTS.USER_SETTINGS_KEY, JSON.stringify(settings));
        return c.json({ success: true })
    },
    getUsers: async (c) => {
        const { limit, offset, query } = c.req.query();
        if (!limit || limit < 0 || limit > 100) {
            return c.text("Invalid limit", 400)
        }
        if (!offset || offset < 0) {
            return c.text("Invalid offset", 400)
        }
        if (query) {
            const { results } = await c.env.DB.prepare(
                `SELECT u.id, u.user_email, u.created_at, u.updated_at,`
                + ` (SELECT COUNT(*) FROM users_address WHERE user_id = u.id) AS address_count`
                + ` FROM users u`
                + ` where u.user_email like ?`
                + ` order by u.id desc limit ? offset ?`
            ).bind(`%${query}%`, limit, offset).all();
            let count = 0;
            if (offset == 0) {
                const { count: userCount } = await c.env.DB.prepare(
                    `SELECT count(*) as count FROM users where user_email like ?`
                ).bind(`%${query}%`).first();
                count = userCount;
            }
            return c.json({
                results: results,
                count: count
            })
        }
        const { results } = await c.env.DB.prepare(
            `SELECT u.id, u.user_email, u.created_at, u.updated_at,`
            + ` (SELECT COUNT(*) FROM users_address WHERE user_id = u.id) AS address_count`
            + ` FROM users u`
            + ` order by u.id desc limit ? offset ?`
        ).bind(limit, offset).all();
        let count = 0;
        if (offset == 0) {
            const { count: userCount } = await c.env.DB.prepare(
                `SELECT count(*) as count FROM users`
            ).first();
            count = userCount;
        }
        return c.json({
            results: results,
            count: count
        })
    },
    createUser: async (c) => {
        const { email, password } = await c.req.json();
        if (!email || !password) {
            return c.text("Invalid email or password", 400)
        }
        // geo data
        const reqIp = c.req.raw.headers.get("cf-connecting-ip")
        const geoData = new GeoData(reqIp, c.req.raw.cf);
        const userInfo = new UserInfo(geoData);
        try {
            checkUserPassword(password);
            const { success } = await c.env.DB.prepare(
                `INSERT INTO users (user_email, password, user_info)`
                + ` VALUES (?, ?, ?)`
            ).bind(
                email, password, JSON.stringify(userInfo)
            ).run();
            if (!success) {
                return c.text("Failed to register", 500)
            }
        } catch (e) {
            if (e.message && e.message.includes("UNIQUE")) {
                return c.text("User already exists", 400)
            }
            return c.text(`Failed to register: ${e.message}`, 500)
        }
        return c.json({ success: true })
    },
    deleteUser: async (c) => {
        const { user_id } = c.req.param();
        if (!user_id) return c.text("Invalid user_id", 400);
        const { success } = await c.env.DB.prepare(
            `DELETE FROM users WHERE id = ?`
        ).bind(user_id).run();
        const { success: addressSuccess } = await c.env.DB.prepare(
            `DELETE FROM users_address WHERE user_id = ?`
        ).bind(user_id).run();
        if (!success || !addressSuccess) {
            return c.text("Failed to delete user", 500)
        }
        return c.json({ success: true })
    },
    resetPassword: async (c) => {
        const { user_id } = c.req.param();
        const { password } = await c.req.json();
        if (!user_id) return c.text("Invalid user_id", 400);
        try {
            checkUserPassword(password);
            const { success } = await c.env.DB.prepare(
                `UPDATE users SET password = ? WHERE id = ?`
            ).bind(password, user_id).run();
            if (!success) {
                return c.text("Failed to reset password", 500)
            }
        } catch (e) {
            return c.text(`Failed to reset password: ${e.message}`, 500)
        }
        return c.json({ success: true });
    },
}
