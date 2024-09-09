import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'

import { getBooleanValue, getDomains, getStringValue, getIntValue, getUserRoles, getDefaultDomains, getJsonSetting } from './utils';
import { HonoCustomType, UserRole } from './types';
import { unbindTelegramByAddress } from './telegram_api/common';
import { CONSTANTS } from './constants';
import { AdminWebhookSettings, WebhookMail, WebhookSettings } from './models';

const DEFAULT_NAME_REGEX = /[^a-z0-9]/g;

const checkNameRegex = (c: Context<HonoCustomType>, name: string) => {
    let error = null;
    try {
        const regexStr = getStringValue(c.env.ADDRESS_CHECK_REGEX);
        if (!regexStr) return;
        const regex = new RegExp(regexStr);
        if (!regex.test(name)) {
            error = new Error(`Name not match regex: /${regexStr}/`);
        }
    }
    catch (e) {
        console.error("Failed to check address regex", e);
    }
    if (error) {
        throw error;
    }
}

const getNameRegex = (c: Context<HonoCustomType>): RegExp => {
    try {
        const regex = getStringValue(c.env.ADDRESS_REGEX);
        if (!regex) {
            return DEFAULT_NAME_REGEX;
        }
        return new RegExp(regex, 'g');
    }
    catch (e) {
        console.error("Failed to get address regex", e);
    }
    return DEFAULT_NAME_REGEX;
}

export const newAddress = async (
    c: Context<HonoCustomType>,
    {
        name,
        domain,
        enablePrefix,
        checkLengthByConfig = true,
        addressPrefix = null,
        checkAllowDomains = true,
        enableCheckNameRegex = true,
    }: {
        name: string, domain: string | undefined | null,
        enablePrefix: boolean,
        checkLengthByConfig?: boolean,
        addressPrefix?: string | undefined | null,
        checkAllowDomains?: boolean,
        enableCheckNameRegex?: boolean,
    }
): Promise<{ address: string, jwt: string }> => {
    // remove special characters
    name = name.replace(getNameRegex(c), '')
    // check name
    if (enableCheckNameRegex) {
        await checkNameBlockList(c, name);
        checkNameRegex(c, name);
    }
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

const checkNameBlockList = async (
    c: Context<HonoCustomType>, name: string
): Promise<void> => {
    // check name block list
    const blockList = [] as string[];
    try {
        const value = await getJsonSetting(c, CONSTANTS.ADDRESS_BLOCK_LIST_KEY);
        blockList.push(...(value || []));
    } catch (error) {
        console.error(error);
    }
    if (blockList.some((item) => name.includes(item))) {
        throw new Error(`Name[${name}]is blocked`);
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

export async function sendWebhook(settings: WebhookSettings, formatMap: WebhookMail): Promise<{ success: boolean, message?: string }> {
    // send webhook
    let body = settings.body;
    for (const key of Object.keys(formatMap)) {
        /* eslint-disable no-useless-escape */
        body = body.replace(
            new RegExp(`\\$\\{${key}\\}`, "g"),
            JSON.stringify(
                formatMap[key as keyof WebhookMail]
            ).replace(/^"(.*)"$/, '\$1')
        );
        /* eslint-enable no-useless-escape */
    }
    console.log("send webhook", settings.url, settings.method, settings.headers, body);
    const response = await fetch(settings.url, {
        method: settings.method,
        headers: JSON.parse(settings.headers),
        body: body
    });
    if (!response.ok) {
        console.log("send webhook error", response.status, response.statusText);
        return { success: false, message: `send webhook error: ${response.status} ${response.statusText}` };
    }
    return { success: true }
}

export async function triggerWebhook(
    c: Context<HonoCustomType>,
    address: string,
    raw_mail: string,
    message_id: string | null
): Promise<void> {
    if (!c.env.KV || !getBooleanValue(c.env.ENABLE_WEBHOOK)) {
        return
    }
    const webhookList: WebhookSettings[] = []

    // admin mail webhook
    const adminMailWebhookSettings = await c.env.KV.get<WebhookSettings>(CONSTANTS.WEBHOOK_KV_ADMIN_MAIL_SETTINGS_KEY, "json");
    if (adminMailWebhookSettings?.enabled) {
        webhookList.push(adminMailWebhookSettings)
    }

    // user mail webhook
    const adminSettings = await c.env.KV.get<AdminWebhookSettings>(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, "json");
    if (adminSettings?.allowList.includes(address)) {
        const settings = await c.env.KV.get<WebhookSettings>(
            `${CONSTANTS.WEBHOOK_KV_USER_SETTINGS_KEY}:${address}`, "json"
        );
        if (settings?.enabled) {
            webhookList.push(settings)
        }
    }

    // no webhook
    if (webhookList.length === 0) {
        return
    }
    const mailId = await c.env.DB.prepare(
        `SELECT id FROM raw_mails where address = ? and message_id = ?`
    ).bind(address, message_id).first<string>("id");

    const parsedEmail = await commonParseMail(raw_mail);
    const webhookMail = {
        id: mailId || "",
        url: c.env.FRONTEND_URL ? `${c.env.FRONTEND_URL}?mail_id=${mailId}` : "",
        from: parsedEmail?.sender || "",
        to: address,
        subject: parsedEmail?.subject || "",
        raw: raw_mail,
        parsedText: parsedEmail?.text || "",
        parsedHtml: parsedEmail?.html || ""
    }
    for (const settings of webhookList) {
        const res = await sendWebhook(settings, webhookMail);
        if (!res.success) {
            console.error(res.message);
        }
    }
}
