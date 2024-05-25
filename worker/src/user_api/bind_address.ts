import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'

import { HonoCustomType } from '../types';
import { UserSettings } from "../models";
import { getJsonSetting } from "../utils"
import { CONSTANTS } from "../constants";

export default {
    bind: async (c: Context<HonoCustomType>) => {
        const { user_id } = c.get("userPayload");
        const { address_id } = c.get("jwtPayload");
        if (!address_id || !user_id) {
            return c.text("No address or user token", 400)
        }
        // check if address exists
        const db_address_id = await c.env.DB.prepare(
            `SELECT id FROM address where id = ?`
        ).bind(address_id).first("id");
        if (!db_address_id) {
            return c.text("Address not found", 400)
        }
        // check if user exists
        const db_user_id = await c.env.DB.prepare(
            `SELECT id FROM users where id = ?`
        ).bind(user_id).first("id");
        if (!db_user_id) {
            return c.text("User not found", 400)
        }
        // check if binded
        const db_user_address_id = await c.env.DB.prepare(
            `SELECT user_id FROM users_address where user_id = ? and address_id = ?`
        ).bind(user_id, address_id).first("user_id");
        if (db_user_address_id) return c.json({ success: true })
        // check if binded address count
        const value = await getJsonSetting(c, CONSTANTS.USER_SETTINGS_KEY);
        const settings = new UserSettings(value);
        if (settings.maxAddressCount > 0) {
            const { count } = await c.env.DB.prepare(
                `SELECT COUNT(*) as count FROM users_address where user_id = ?`
            ).bind(user_id).first<{ count: number }>() || { count: 0 };
            if (count >= settings.maxAddressCount) {
                return c.text("Max address count reached", 400)
            }
        }
        // bind
        try {
            const { success } = await c.env.DB.prepare(
                `INSERT INTO users_address (user_id, address_id) VALUES (?, ?)`
            ).bind(user_id, address_id).run();
            if (!success) {
                return c.text("Failed to bind", 500)
            }
        } catch (e) {
            const error = e as Error;
            if (error.message && error.message.includes("UNIQUE")) {
                return c.text("Address already binded, please unbind first", 400)
            }
            return c.text("Failed to bind", 500)
        }
        return c.json({ success: true })
    },
    unbind: async (c: Context<HonoCustomType>) => {
        const { user_id } = c.get("userPayload");
        const { address_id } = await c.req.json();
        if (!address_id || !user_id) {
            return c.text("Invalid address or user token", 400)
        }
        // check if address exists
        const db_address_id = await c.env.DB.prepare(
            `SELECT id FROM address where id = ?`
        ).bind(address_id).first("id");
        if (!db_address_id) {
            return c.text("Address not found", 400)
        }
        // check if user exists
        const db_user_id = await c.env.DB.prepare(
            `SELECT id FROM users where id = ?`
        ).bind(user_id).first("id");
        if (!db_user_id) {
            return c.text("User not found", 400)
        }
        // unbind
        try {
            const { success } = await c.env.DB.prepare(
                `DELETE FROM users_address where user_id = ? and address_id = ?`
            ).bind(user_id, address_id).run();
            if (!success) {
                return c.text("Failed to unbind", 500)
            }
        } catch (e) {
            return c.text("Invalid address token", 400)
        }
        return c.json({ success: true })
    },
    getBindedAddresses: async (c: Context<HonoCustomType>) => {
        const { user_id } = c.get("userPayload");
        if (!user_id) {
            return c.text("No user token", 400)
        }
        // select binded address
        const { results } = await c.env.DB.prepare(
            `SELECT a.*,`
            + ` (SELECT COUNT(*) FROM raw_mails WHERE address = a.name) AS mail_count,`
            + ` (SELECT COUNT(*) FROM sendbox WHERE address = a.name) AS send_count`
            + ` FROM address a `
            + ` JOIN users_address ua `
            + ` ON ua.address_id = a.id `
            + ` WHERE ua.user_id = ?`
            + ` ORDER BY a.id DESC`
        ).bind(user_id).all();
        return c.json({
            results: results,
        })
    },
    getBindedAddressJwt: async (c: Context<HonoCustomType>) => {
        const { address_id } = c.req.param();
        // check binded
        const { user_id } = c.get("userPayload");
        if (!address_id || !user_id) {
            return c.text("Invalid address or user token", 400)
        }
        // check users_address if address binded
        const db_user_id = await c.env.DB.prepare(
            `SELECT user_id FROM users_address WHERE address_id = ? and user_id = ?`
        ).bind(address_id, user_id).first("user_id");
        if (!db_user_id) {
            return c.text("Address not binded", 400)
        }
        // generate jwt
        const name = await c.env.DB.prepare(
            `SELECT name FROM address WHERE id = ? `
        ).bind(address_id).first("name");
        const jwt = await Jwt.sign({
            address: name,
            address_id: address_id
        }, c.env.JWT_SECRET, "HS256")
        return c.json({
            jwt: jwt
        })
    },
}
