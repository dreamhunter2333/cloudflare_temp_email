import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'

import { getBooleanValue, getDomains, getStringValue, getIntValue, getUserRoles, getDefaultDomains } from './utils';
import { HonoCustomType, UserRole } from './types';
import { unbindTelegramByAddress } from './telegram_api/common';

export const newAddress = async (
    c: Context<HonoCustomType>,
    name: string, domain: string | undefined | null,
    enablePrefix: boolean,
    checkLengthByConfig: boolean = true,
    addressPrefix: string | undefined | null = null,
    checkAllowDomains: boolean = true
): Promise<{ address: string, jwt: string }> => {
    // remove special characters
    name = name.replace(/[^a-z0-9]/g, '')
    // name min length min 1
    const minAddressLength = Math.max(
        checkLengthByConfig ? getIntValue(c.env.MIN_ADDRESS_LEN, 1) : 1,
        1
    );
    // name max length min 1
    const maxAddressLength = Math.max(
        checkLengthByConfig ? getIntValue(c.env.MAX_ADDRESS_LEN, 30) : 30,
        1
    );
    // check name length
    if (name.length < minAddressLength) {
        throw new Error(`Name too short (min ${minAddressLength})`);
    }
    if (name.length > maxAddressLength) {
        throw new Error(`Name too long (max ${maxAddressLength})`);
    }
    // create address with prefix
    if (typeof addressPrefix === "string") {
        name = addressPrefix + name;
    } else if (enablePrefix) {
        name = getStringValue(c.env.PREFIX) + name;
    }
    // check domain
    const allowDomains = checkAllowDomains ? await getAllowDomains(c) : getDomains(c);
    // if domain is not set, use the first domain
    if (!domain && allowDomains.length > 0) {
        domain = allowDomains[0];
    }
    // check domain is valid
    if (!domain || !allowDomains.includes(domain)) {
        throw new Error("Invalid domain")
    }
    // create address
    name = name + "@" + domain;
    try {
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address(name) VALUES(?)`
        ).bind(name).run();
        if (!success) {
            throw new Error("Failed to create address")
        }
    } catch (e) {
        const message = (e as Error).message;
        if (message && message.includes("UNIQUE")) {
            throw new Error("Address already exists")
        }
        throw new Error("Failed to create address")
    }
    const address_id = await c.env.DB.prepare(
        `SELECT id FROM address where name = ?`
    ).bind(name).first<number>("id");
    // create jwt
    const jwt = await Jwt.sign({
        address: name,
        address_id: address_id
    }, c.env.JWT_SECRET, "HS256")
    return {
        jwt: jwt,
        address: name,
    }
}

export const cleanup = async (
    c: Context<HonoCustomType>,
    cleanType: string | undefined | null,
    cleanDays: number | undefined | null
): Promise<boolean> => {
    if (!cleanType || typeof cleanDays !== 'number' || cleanDays < 0 || cleanDays > 30) {
        throw new Error("Invalid cleanType or cleanDays")
    }
    console.log(`Cleanup ${cleanType} before ${cleanDays} days`);
    switch (cleanType) {
        case "mails":
            await c.env.DB.prepare(`
                DELETE FROM raw_mails WHERE created_at < datetime('now', '-${cleanDays} day')`
            ).run();
            break;
        case "mails_unknow":
            await c.env.DB.prepare(`
                DELETE FROM raw_mails WHERE address NOT IN
                (select name from address) AND created_at < datetime('now', '-${cleanDays} day')`
            ).run();
            break;
        case "sendbox":
            await c.env.DB.prepare(`
                DELETE FROM sendbox WHERE created_at < datetime('now', '-${cleanDays} day')`
            ).run();
            break;
        default:
            throw new Error("Invalid cleanType")
    }
    return true;
}

/**
 * TODO: need senbox delete?
 */
export const deleteAddressWithData = async (
    c: Context<HonoCustomType>,
    address: string | undefined | null,
    address_id: number | undefined | null
): Promise<boolean> => {
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        throw new Error("Delete email is disabled")
    }
    if (!address && !address_id) {
        throw new Error("Address or address_id required")
    }
    // get address_id or address
    if (!address_id) {
        address_id = await c.env.DB.prepare(
            `SELECT id FROM address where name = ?`
        ).bind(address).first<number>("id");
    } else if (!address) {
        address = await c.env.DB.prepare(
            `SELECT name FROM address where id = ?`
        ).bind(address_id).first<string>("name");
    }
    // check address again
    if (!address || !address_id) {
        throw new Error("Can't find address");
    }
    // unbind telegram
    await unbindTelegramByAddress(c, address);
    // delete address and related data
    const { success: mailSuccess } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address = ? `
    ).bind(address).run();
    const { success: sendAccess } = await c.env.DB.prepare(
        `DELETE FROM address_sender WHERE address = ? `
    ).bind(address).run();
    const { success: addressSuccess } = await c.env.DB.prepare(
        `DELETE FROM users_address WHERE address_id = ? `
    ).bind(address_id).run();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address WHERE name = ? `
    ).bind(address).run();
    if (!success || !mailSuccess || !addressSuccess || !sendAccess) {
        throw new Error("Failed to delete address")
    }
    return true;
}

export const handleListQuery = async (
    c: Context<HonoCustomType>,
    query: string, countQuery: string, params: string[],
    limit: string | number | undefined | null,
    offset: string | number | undefined | null
): Promise<Response> => {
    if (typeof limit === "string") {
        limit = parseInt(limit);
    }
    if (typeof offset === "string") {
        offset = parseInt(offset);
    }
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (offset == null || offset == undefined || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    const resultsQuery = `${query} order by id desc limit ? offset ?`;
    const { results } = await c.env.DB.prepare(resultsQuery).bind(
        ...params, limit, offset
    ).all();
    const count = offset == 0 ? await c.env.DB.prepare(
        countQuery
    ).bind(...params).first("count") : 0;
    return c.json({ results, count });
}


export const commonParseMail = async (raw_mail: string | undefined | null): Promise<{
    sender: string,
    subject: string,
    text: string,
    html: string
} | undefined> => {
    if (!raw_mail) {
        return undefined;
    }
    // TODO: WASM parse email
    // try {
    //     const { parse_message_wrapper } = await import('mail-parser-wasm-worker');

    //     const parsedEmail = parse_message_wrapper(raw_mail);
    //     return {
    //         sender: parsedEmail.sender || "",
    //         subject: parsedEmail.subject || "",
    //         text: parsedEmail.text || "",
    //         html: parsedEmail.body_html || "",
    //     };
    // } catch (e) {
    //     console.error("Failed use mail-parser-wasm-worker to parse email", e);
    // }
    try {
        const { default: PostalMime } = await import('postal-mime');
        const parsedEmail = await PostalMime.parse(raw_mail);
        return {
            sender: parsedEmail.from ? `${parsedEmail.from.name} <${parsedEmail.from.address}>` : "",
            subject: parsedEmail.subject || "",
            text: parsedEmail.text || "",
            html: parsedEmail.html || "",
        };
    }
    catch (e) {
        console.error("Failed use PostalMime to parse email", e);
    }
    return undefined;
}

export const commonGetUserRole = async (
    c: Context<HonoCustomType>, user_id: number
): Promise<UserRole | undefined | null> => {
    const user_roles = getUserRoles(c);
    const role_text = await c.env.DB.prepare(
        `SELECT role_text FROM user_roles where user_id = ?`
    ).bind(user_id).first<string | undefined | null>("role_text");
    return role_text ? user_roles.find((r) => r.role === role_text) : null;
}

export const getAddressPrefix = async (c: Context<HonoCustomType>): Promise<string | undefined> => {
    const user = c.get("userPayload");
    if (!user) {
        return c.env.PREFIX;
    }
    const user_role = await commonGetUserRole(c, user.user_id);
    if (typeof user_role?.prefix === "string") {
        return user_role.prefix;
    }
    return c.env.PREFIX;
}

export const getAllowDomains = async (c: Context<HonoCustomType>): Promise<string[]> => {
    const user = c.get("userPayload");
    if (!user) {
        return getDefaultDomains(c);
    }
    const user_role = await commonGetUserRole(c, user.user_id);
    return user_role?.domains || getDefaultDomains(c);;
}
