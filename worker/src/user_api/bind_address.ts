import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'

import { isAddressCountLimitReached } from "../utils"
import { unbindTelegramByAddress } from '../telegram_api/common';
import i18n from '../i18n';
import { updateAddressUpdatedAt, commonGetUserRole, hideObjectFields } from '../common';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type BindedAddress = {
    id: number;
    name: string;
    mail_count?: number;
    send_count?: number;
    created_at: string;
    updated_at: string;
};

const escapeLikeQuery = (query: string): string => {
    return query.replace(/[\\%_]/g, '\\$&');
}

const UserBindAddressModule = {
    bind: async (c: Context<HonoCustomType>) => {
        const { user_id } = c.get("userPayload");
        const { address_id } = c.get("jwtPayload");
        return await UserBindAddressModule.bindByID(c, user_id, address_id)
    },
    bindByID: async (
        c: Context<HonoCustomType>,
        user_id: number | string, address_id: number | string
    ) => {
        const msgs = i18n.getMessagesbyContext(c);
        if (!address_id || !user_id) {
            return c.text(msgs.NoAddressOrUserTokenMsg, 400)
        }
        // check if address exists
        const db_address_id = await c.env.DB.prepare(
            `SELECT id FROM address where id = ?`
        ).bind(address_id).first("id");
        if (!db_address_id) {
            return c.text(msgs.AddressNotFoundMsg, 400)
        }
        // check if user exists
        const db_user_id = await c.env.DB.prepare(
            `SELECT id FROM users where id = ?`
        ).bind(user_id).first("id");
        if (!db_user_id) {
            return c.text(msgs.UserNotFoundMsg, 400)
        }
        // check if binded
        const db_user_address_id = await c.env.DB.prepare(
            `SELECT user_id FROM users_address where user_id = ? and address_id = ?`
        ).bind(user_id, address_id).first("user_id");
        if (db_user_address_id) return c.json({ success: true })
        // check if binded address count
        const userRole = c.get("userRolePayload");
        if (await isAddressCountLimitReached(c, user_id, userRole)) {
            return c.text(msgs.MaxAddressCountReachedMsg, 400)
        }
        // bind
        try {
            const { success } = await c.env.DB.prepare(
                `INSERT INTO users_address (user_id, address_id) VALUES (?, ?)`
            ).bind(user_id, address_id).run();
            if (!success) {
                return c.text(msgs.OperationFailedMsg, 500)
            }
        } catch (e) {
            const error = e as Error;
            if (error.message && error.message.includes("UNIQUE")) {
                return c.text(msgs.AddressAlreadyBindedMsg, 400)
            }
            return c.text(msgs.OperationFailedMsg, 500)
        }
        return c.json({ success: true })
    },
    unbind: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const { user_id } = c.get("userPayload");
        const { address_id } = await c.req.json();
        if (!address_id || !user_id) {
            return c.text(msgs.InvalidAddressOrUserTokenMsg, 400)
        }
        // check if address exists
        const db_address_id = await c.env.DB.prepare(
            `SELECT id FROM address where id = ?`
        ).bind(address_id).first("id");
        if (!db_address_id) {
            return c.text(msgs.AddressNotFoundMsg, 400)
        }
        // check if user exists
        const db_user_id = await c.env.DB.prepare(
            `SELECT id FROM users where id = ?`
        ).bind(user_id).first("id");
        if (!db_user_id) {
            return c.text(msgs.UserNotFoundMsg, 400)
        }
        // unbind
        try {
            const { success } = await c.env.DB.prepare(
                `DELETE FROM users_address where user_id = ? and address_id = ?`
            ).bind(user_id, address_id).run();
            if (!success) {
                return c.text(msgs.OperationFailedMsg, 500)
            }
        } catch (e) {
            return c.text(msgs.OperationFailedMsg, 500)
        }
        return c.json({ success: true })
    },
    getBindedAddresses: async (c: Context<HonoCustomType>) => {
        const { user_id } = c.get("userPayload");
        const msgs = i18n.getMessagesbyContext(c);
        const { limit: limitParam, offset: offsetParam, query, with_counts, with_total } = c.req.query();
        const limit = limitParam === undefined ? DEFAULT_PAGE_SIZE : Number(limitParam);
        const offset = offsetParam === undefined ? 0 : Number(offsetParam);
        if (!Number.isInteger(limit) || limit <= 0 || limit > MAX_PAGE_SIZE) {
            return c.text(msgs.InvalidLimitMsg, 400);
        }
        if (!Number.isInteger(offset) || offset < 0) {
            return c.text(msgs.InvalidOffsetMsg, 400);
        }
        const includeTotal = with_total !== 'false';
        const { results, count } = await UserBindAddressModule.getBindedAddressesPageById(
            c,
            user_id,
            limit,
            offset,
            query?.trim() || '',
            with_counts !== 'false',
            includeTotal,
        );
        if (!includeTotal) {
            return c.json({ results });
        }
        return c.json({ results, count });
    },
    getBindedAddressesPageById: async (
        c: Context<HonoCustomType>,
        user_id: number | string,
        limit: number,
        offset: number,
        query: string,
        includeCounts: boolean,
        includeTotal: boolean,
    ): Promise<{ results: BindedAddress[], count: number }> => {
        const params: (number | string)[] = [user_id];
        const filters = ['ua.user_id = ?'];
        if (query) {
            const likeParam = `%${escapeLikeQuery(query)}%`;
            const useInstr = new TextEncoder().encode(likeParam).length > 50;
            filters.push(useInstr ? `instr(a.name, ?) > 0` : `a.name LIKE ? ESCAPE '\\'`);
            params.push(useInstr ? query : likeParam);
        }
        const countFields = includeCounts
            ? `, (SELECT COUNT(*) FROM raw_mails WHERE address = a.name) AS mail_count`
                + `, (SELECT COUNT(*) FROM sendbox WHERE address = a.name) AS send_count`
            : '';
        const fromQuery = ` FROM address a`
            + ` JOIN users_address ua ON ua.address_id = a.id`
            + ` WHERE ${filters.join(' AND ')}`;
        const resultsStatement = c.env.DB.prepare(
            `SELECT a.id, a.name, a.created_at, a.updated_at${countFields}`
            + fromQuery
            + ` ORDER BY a.id DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset);
        if (!includeTotal) {
            const { results } = await resultsStatement.all<BindedAddress>();
            return { results: results || [], count: 0 };
        }
        const [pageResult, countResult] = await c.env.DB.batch([
            resultsStatement,
            c.env.DB.prepare(`SELECT COUNT(*) AS count${fromQuery}`).bind(...params),
        ]);
        const countRow = countResult.results?.[0] as { count?: number } | undefined;
        return {
            results: (pageResult.results || []) as BindedAddress[],
            count: countRow?.count || 0,
        };
    },
    getBindedAddressesById: async (
        c: Context<HonoCustomType>, user_id: number | string
    ): Promise<BindedAddress[]> => {
        const msgs = i18n.getMessagesbyContext(c);
        if (!user_id) {
            throw new Error(msgs.UserNotFoundMsg);
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
        ).bind(user_id).all<BindedAddress>();
        return (results || []).map((row) => hideObjectFields(row, ['password']));
    },
    getBindedAddressJwt: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const { address_id } = c.req.param();
        // check binded
        const { user_id } = c.get("userPayload");
        if (!address_id || !user_id) {
            return c.text(msgs.InvalidAddressOrUserTokenMsg, 400)
        }
        // check users_address if address binded
        const db_user_id = await c.env.DB.prepare(
            `SELECT user_id FROM users_address WHERE address_id = ? and user_id = ?`
        ).bind(address_id, user_id).first("user_id");
        if (!db_user_id) {
            return c.text(msgs.AddressNotBindedMsg, 400)
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
    transferAddress: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const { user_id } = c.get("userPayload");
        const { address_id, target_user_email } = await c.req.json();
        // check if address exists
        const address = await c.env.DB.prepare(
            `SELECT name FROM address where id = ?`
        ).bind(address_id).first<string>("name");
        if (!address) {
            return c.text(msgs.AddressNotFoundMsg, 400)
        }
        // check if user exists
        const db_user_id = await c.env.DB.prepare(
            `SELECT id FROM users where id = ?`
        ).bind(user_id).first("id");
        if (!db_user_id) {
            return c.text(msgs.UserNotFoundMsg, 400)
        }
        // check if target user exists
        const target_user_id = await c.env.DB.prepare(
            `SELECT id FROM users where user_email = ?`
        ).bind(target_user_email).first<number>("id");
        if (!target_user_id) {
            return c.text(msgs.TargetUserNotFoundMsg, 400)
        }
        // check target user binded address count
        const userRoleObj = await commonGetUserRole(c, target_user_id);
        if (await isAddressCountLimitReached(c, target_user_id, userRoleObj?.role)) {
            return c.text(msgs.MaxAddressCountReachedMsg, 400)
        }
        // check if binded
        const db_user_address_id = await c.env.DB.prepare(
            `SELECT user_id FROM users_address where user_id = ? and address_id = ?`
        ).bind(user_id, address_id).first("user_id");
        if (!db_user_address_id) return c.text(msgs.AddressNotBindedMsg, 400)
        // unbind telegram address
        await unbindTelegramByAddress(c, address);
        // unbind user address
        try {
            const { success } = await c.env.DB.prepare(
                `DELETE FROM users_address where user_id = ? and address_id = ?`
            ).bind(user_id, address_id).run();
            if (!success) {
                return c.text(msgs.OperationFailedMsg, 500)
            }
        } catch (e) {
            return c.text(msgs.OperationFailedMsg, 500)
        }
        // delete address
        await c.env.DB.prepare(
            `DELETE FROM address WHERE id = ? `
        ).bind(address_id).run();
        // new address
        const { success: newAddressSuccess } = await c.env.DB.prepare(
            `INSERT INTO address(name) VALUES(?)`
        ).bind(address).run();
        if (!newAddressSuccess) {
            throw new Error(msgs.FailedCreateAddressMsg)
        }
        await updateAddressUpdatedAt(c, address);
        // find new address id
        const new_address_id = await c.env.DB.prepare(
            `SELECT id FROM address WHERE name = ?`
        ).bind(address).first<number | null | undefined>("id");
        if (!new_address_id) {
            throw new Error(msgs.OperationFailedMsg)
        }
        // bind
        try {
            const { success } = await c.env.DB.prepare(
                `INSERT INTO users_address (user_id, address_id) VALUES (?, ?)`
            ).bind(target_user_id, new_address_id).run();
            if (!success) {
                return c.text(msgs.OperationFailedMsg, 500)
            }
        } catch (e) {
            const error = e as Error;
            if (error.message && error.message.includes("UNIQUE")) {
                return c.text(msgs.AddressAlreadyBindedMsg, 400)
            }
            return c.text(msgs.OperationFailedMsg, 500)
        }
        return c.json({ success: true })
    }
}

export default UserBindAddressModule;
