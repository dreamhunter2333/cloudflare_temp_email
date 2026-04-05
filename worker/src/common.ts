import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'
import { WorkerMailerOptions } from 'worker-mailer';

import { getBooleanValue, getDomains, getStringValue, getIntValue, getUserRoles, getDefaultDomains, getJsonSetting, getAnotherWorkerList, hashPassword, getJsonObjectValue, getRandomSubdomainDomains, getDomainMapValue, includesDomain, normalizeDomain, normalizeEmailAddress } from './utils';
import { unbindTelegramByAddress } from './telegram_api/common';
import { CONSTANTS } from './constants';
import { AddressCreationSettings, AdminWebhookSettings, WebhookMail, WebhookSettings } from './models';
import i18n from './i18n';

const DEFAULT_NAME_REGEX = /[^a-z0-9]/g;
const DEFAULT_RANDOM_SUBDOMAIN_LENGTH = 8;
const MAX_RANDOM_SUBDOMAIN_ATTEMPTS = 5;
const MAX_DOMAIN_LENGTH = 253;
const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const isValidDomainLabel = (label: string): boolean => {
    return DOMAIN_LABEL_RE.test(label);
}

const areValidDomainLabels = (labels: string[]): boolean => {
    return labels.length > 0 && labels.every((label) => isValidDomainLabel(label));
}

/**
 * Check if send mail is enabled for a specific domain
 */
export const isSendMailEnabled = (
    c: Context<HonoCustomType>,
    mailDomain: string
): boolean => {
    const normalizedMailDomain = normalizeDomain(mailDomain);
    if (!normalizedMailDomain) return false;
    // Check resend token for domain or global
    const resendEnabled = c.env.RESEND_TOKEN || c.env[
        `RESEND_TOKEN_${normalizedMailDomain.replace(/\./g, "_").toUpperCase()}`
    ];
    if (resendEnabled) return true;

    // Check SMTP config for domain
    const smtpConfigMap = getJsonObjectValue<Record<string, WorkerMailerOptions>>(c.env.SMTP_CONFIG);
    if (getDomainMapValue(smtpConfigMap, normalizedMailDomain)) return true;

    // Check SEND_MAIL binding
    if (c.env.SEND_MAIL) return true;

    return false;
}

/**
 * Check if send mail is enabled for any configured domain
 */
export const isAnySendMailEnabled = (c: Context<HonoCustomType>): boolean => {
    const domains = getDomains(c);
    return domains.some(domain => isSendMailEnabled(c, domain));
}

export const generateRandomName = (c: Context<HonoCustomType>): string => {
    // name min length min 1
    const minLength = Math.max(
        getIntValue(c.env.MIN_ADDRESS_LEN, 1),
        1
    );
    // name max length min 1
    const maxLength = Math.max(
        getIntValue(c.env.MAX_ADDRESS_LEN, 30),
        1
    );

    // Build full name recursively until minimum length is reached
    const buildName = (currentName: string = ""): string => {
        return currentName.length >= minLength
            ? currentName
            : buildName(currentName + Math.random().toString(36).substring(2, 15));
    };

    const fullName = buildName();

    // Return truncated to max length
    return fullName.substring(0, Math.min(fullName.length, maxLength));
};

const generateRandomSubdomain = (c: Context<HonoCustomType>): string => {
    const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    const length = Math.min(
        Math.max(getIntValue(c.env.RANDOM_SUBDOMAIN_LENGTH, DEFAULT_RANDOM_SUBDOMAIN_LENGTH), 1),
        63
    );
    let subdomain = "";
    for (let i = 0; i < length; i++) {
        subdomain += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return subdomain;
}

const allowRandomSubdomainForDomain = (
    c: Context<HonoCustomType>,
    domain: string
): boolean => {
    return includesDomain(getRandomSubdomainDomains(c), domain);
}

const isCreateAddressSubdomainMatchEnvConfigured = (c: Context<HonoCustomType>): boolean => {
    return c.env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH !== undefined
        && c.env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH !== null
        && c.env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH !== "";
}

export const getAddressCreationSettings = async (
    c: Context<HonoCustomType>
): Promise<AddressCreationSettings> => {
    const value = await getJsonSetting<AddressCreationSettings>(
        c, CONSTANTS.ADDRESS_CREATION_SETTINGS_KEY
    );
    return new AddressCreationSettings(value);
}

export const getAddressCreationSubdomainMatchStatus = async (
    c: Context<HonoCustomType>,
    existingSettings?: AddressCreationSettings
): Promise<{
    envConfigured: boolean,
    envEnabled: boolean,
    storedEnabled: boolean | undefined,
    effectiveEnabled: boolean,
}> => {
    const envConfigured = isCreateAddressSubdomainMatchEnvConfigured(c);
    const envEnabled = getBooleanValue(c.env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH);
    const addressCreationSettings = existingSettings || await getAddressCreationSettings(c);
    const storedEnabled = addressCreationSettings.enableSubdomainMatch;

    // 业务约束：env=false 作为全局 kill switch，后台开关不能强行打开。
    const effectiveEnabled = envConfigured && !envEnabled
        ? false
        : typeof storedEnabled === "boolean"
            ? storedEnabled
            : envEnabled;

    return {
        envConfigured,
        envEnabled,
        storedEnabled,
        effectiveEnabled,
    };
}

const findMatchedAllowedDomain = (
    domain: string,
    allowDomains: string[],
    enableSubdomainMatch: boolean,
): string | null => {
    const normalizedDomain = normalizeDomain(domain);
    if (normalizedDomain.length > MAX_DOMAIN_LENGTH) {
        return null;
    }
    const domainLabels = normalizedDomain.split('.');
    if (!areValidDomainLabels(domainLabels)) {
        return null;
    }
    const normalizedAllowDomains = allowDomains.map((allowDomain) => normalizeDomain(allowDomain));
    if (normalizedAllowDomains.includes(normalizedDomain)) {
        return normalizedDomain;
    }
    if (!enableSubdomainMatch) {
        return null;
    }
    const matchedDomain = [...normalizedAllowDomains]
        .sort((a, b) => b.length - a.length)
        .find((allowDomain) => {
            if (allowDomain.length > MAX_DOMAIN_LENGTH) {
                return false;
            }
            const allowDomainLabels = allowDomain.split('.');
            if (!areValidDomainLabels(allowDomainLabels)) {
                return false;
            }
            if (domainLabels.length <= allowDomainLabels.length) {
                return false;
            }
            const prefixLabels = domainLabels.slice(0, domainLabels.length - allowDomainLabels.length);
            if (!areValidDomainLabels(prefixLabels)) {
                return false;
            }
            return allowDomainLabels.every((label, index) => {
                return domainLabels[domainLabels.length - allowDomainLabels.length + index] === label;
            });
        });
    return matchedDomain || null;
}

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

export function updateAddressUpdatedAt(
    c: Context<HonoCustomType>,
    address: string | undefined | null
): void {
    if (!address) {
        return;
    }
    // update address updated_at asynchronously
    c.executionCtx.waitUntil((async () => {
        try {
            await c.env.DB.prepare(
                `UPDATE address SET updated_at = datetime('now') where name = ?`
            ).bind(address).run();
        } catch (e) {
            console.warn("[updateAddressUpdatedAt] failed:", address, e);
        }
    })());
}

export const generateRandomPassword = (): string => {
    const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

const generatePasswordForAddress = async (
    c: Context<HonoCustomType>,
    address: string
): Promise<string | null> => {
    if (!getBooleanValue(c.env.ENABLE_ADDRESS_PASSWORD)) {
        return null;
    }

    const plainPassword = generateRandomPassword();
    const hashedPassword = await hashPassword(plainPassword);
    const { success } = await c.env.DB.prepare(
        `UPDATE address SET password = ?, updated_at = datetime('now') WHERE name = ?`
    ).bind(hashedPassword, address).run();

    if (!success) {
        console.warn("Failed to set generated password for address:", address);
        return null;
    }

    return plainPassword;
}

const insertAddressRecord = async (
    c: Context<HonoCustomType>,
    address: string,
    sourceMeta: string | undefined | null,
    msgs: ReturnType<typeof i18n.getMessagesbyContext>
): Promise<void> => {
    try {
        const result = await c.env.DB.prepare(
            `INSERT INTO address(name, source_meta) VALUES(?, ?)`
        ).bind(address, sourceMeta).run();
        if (!result.success) {
            throw new Error(msgs.FailedCreateAddressMsg)
        }
    } catch (e) {
        const message = (e as Error).message;
        // Fallback: source_meta field may not exist, try without it
        if (message && message.includes("source_meta")) {
            const result = await c.env.DB.prepare(
                `INSERT INTO address(name) VALUES(?)`
            ).bind(address).run();
            if (!result.success) {
                throw new Error(msgs.FailedCreateAddressMsg)
            }
            return;
        }
        throw e;
    }
}

export const newAddress = async (
    c: Context<HonoCustomType>,
    {
        name,
        domain,
        enablePrefix,
        enableRandomSubdomain = false,
        checkLengthByConfig = true,
        addressPrefix = null,
        checkAllowDomains = true,
        enableCheckNameRegex = true,
        sourceMeta = null,
    }: {
        name: string, domain: string | undefined | null,
        enablePrefix: boolean,
        enableRandomSubdomain?: boolean,
        checkLengthByConfig?: boolean,
        addressPrefix?: string | undefined | null,
        checkAllowDomains?: boolean,
        enableCheckNameRegex?: boolean,
        sourceMeta?: string | undefined | null,
    }
): Promise<{ address: string, jwt: string, password?: string | null, address_id: number }> => {
    const msgs = i18n.getMessagesbyContext(c);
    // trim whitespace and remove special characters
    name = name.trim().replace(getNameRegex(c), '')
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
        throw new Error(`${msgs.NameTooShortMsg} (min ${minAddressLength})`);
    }
    if (name.length > maxAddressLength) {
        throw new Error(`${msgs.NameTooLongMsg} (max ${maxAddressLength})`);
    }
    // create address with prefix
    if (typeof addressPrefix === "string") {
        name = addressPrefix.trim() + name;
    } else if (enablePrefix) {
        name = getStringValue(c.env.PREFIX).trim() + name;
    }
    domain = normalizeDomain(domain);
    // check domain
    const allowDomains = checkAllowDomains ? await getAllowDomains(c) : getDomains(c);
    // if domain is not set, select domain based on environment configuration
    if (!domain && allowDomains.length > 0) {
        const createAddressDefaultDomainFirst = getBooleanValue(c.env.CREATE_ADDRESS_DEFAULT_DOMAIN_FIRST);
        if (createAddressDefaultDomainFirst) {
            domain = normalizeDomain(allowDomains[0]);
        } else {
            domain = normalizeDomain(allowDomains[Math.floor(Math.random() * allowDomains.length)]);
        }
    } else if (typeof domain === "string") {
        domain = normalizeDomain(domain);
    }
    const { effectiveEnabled: enableSubdomainMatch } = await getAddressCreationSubdomainMatchStatus(c);
    const matchedAllowDomain = domain
        ? findMatchedAllowedDomain(domain, allowDomains, enableSubdomainMatch)
        : null;
    // check domain is valid
    if (!domain || !matchedAllowDomain) {
        throw new Error(msgs.InvalidDomainMsg)
    }
    if (enableRandomSubdomain && !allowRandomSubdomainForDomain(c, domain)) {
        throw new Error(msgs.RandomSubdomainNotAllowedMsg)
    }

    const maxAttempts = enableRandomSubdomain ? MAX_RANDOM_SUBDOMAIN_ATTEMPTS : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const addressDomain = enableRandomSubdomain
            ? `${generateRandomSubdomain(c)}.${domain}`
            : domain;
        const address = normalizeEmailAddress(`${name}@${addressDomain}`);

        try {
            // Best-effort pre-check so random-subdomain retries can skip obvious duplicates
            // before INSERT. A TOCTOU race with the INSERT below is acceptable because the
            // UNIQUE-constraint handling in the catch block is the definitive guard.
            const existingAddressId = await c.env.DB.prepare(
                `SELECT id FROM address WHERE name = ?`
            ).bind(address).first<number>("id");
            if (existingAddressId) {
                if (enableRandomSubdomain && attempt < maxAttempts - 1) {
                    continue;
                }
                throw new Error(msgs.AddressAlreadyExistsMsg);
            }
            await insertAddressRecord(c, address, sourceMeta, msgs);
            await updateAddressUpdatedAt(c, address);

            const address_id = await c.env.DB.prepare(
                `SELECT id FROM address where name = ?`
            ).bind(address).first<number>("id");

            if (!address_id) {
                throw new Error(msgs.FailedCreateAddressMsg);
            }

            // 如果启用地址密码功能，自动生成密码
            const generatedPassword = await generatePasswordForAddress(c, address);

            // create jwt
            const jwt = await Jwt.sign({
                address: address,
                address_id: address_id
            }, c.env.JWT_SECRET, "HS256")
            return {
                jwt: jwt,
                address: address,
                password: generatedPassword,
                address_id: address_id,
            }
        } catch (e) {
            const message = (e as Error).message;
            if (message && message.includes("UNIQUE")) {
                if (enableRandomSubdomain && attempt < maxAttempts - 1) {
                    continue;
                }
                throw new Error(msgs.AddressAlreadyExistsMsg)
            }
            throw new Error(msgs.FailedCreateAddressMsg)
        }
    }

    throw new Error(msgs.FailedCreateAddressMsg)
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
    const msgs = i18n.getMessagesbyContext(c);
    if (!cleanType || typeof cleanDays !== 'number' || cleanDays < 0 || cleanDays > 1000) {
        throw new Error(msgs.InvalidCleanupConfigMsg)
    }
    console.log(`Cleanup ${cleanType} before ${cleanDays} days`);
    switch (cleanType) {
        case "inactiveAddress":
            await batchDeleteAddressWithData(
                c,
                `updated_at < datetime('now', '-${cleanDays} day')`
            )
            break;
        case "addressCreated":
            await batchDeleteAddressWithData(
                c,
                `created_at < datetime('now', '-${cleanDays} day')`
            )
            break;
        case "unboundAddress":
            await batchDeleteAddressWithData(
                c,
                `id NOT IN (SELECT address_id FROM users_address) AND created_at < datetime('now', '-${cleanDays} day')`
            )
            break;
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
        case "emptyAddress":
            // Delete addresses that have no emails and were created more than N days ago
            await batchDeleteAddressWithData(
                c,
                `name NOT IN (SELECT DISTINCT address FROM raw_mails WHERE address IS NOT NULL) AND created_at < datetime('now', '-${cleanDays} day')`
            )
            break;
        default:
            throw new Error(msgs.InvalidCleanTypeMsg)
    }
    return true;
}

const batchDeleteAddressWithData = async (
    c: Context<HonoCustomType>,
    addressQueryCondition: string,
): Promise<boolean> => {
    await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address IN ( ` +
        `SELECT name FROM address WHERE ${addressQueryCondition})`
    ).run();
    await c.env.DB.prepare(
        `DELETE FROM sendbox WHERE address IN ( ` +
        `SELECT name FROM address WHERE ${addressQueryCondition})`
    ).run();
    await c.env.DB.prepare(
        `DELETE FROM auto_reply_mails WHERE address IN ( ` +
        `SELECT name FROM address WHERE ${addressQueryCondition})`
    ).run();
    await c.env.DB.prepare(
        `DELETE FROM address_sender WHERE address IN ( ` +
        `SELECT name FROM address WHERE ${addressQueryCondition})`
    ).run();
    await c.env.DB.prepare(
        `DELETE FROM users_address WHERE address_id IN ( ` +
        `SELECT id FROM address WHERE ${addressQueryCondition})`
    ).run();
    // delete address
    await c.env.DB.prepare(`
        DELETE FROM address WHERE ${addressQueryCondition}`
    ).run();
    return true;
}


export const deleteAddressWithData = async (
    c: Context<HonoCustomType>,
    address: string | undefined | null,
    address_id: number | undefined | null
): Promise<boolean> => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        throw new Error(msgs.UserDeleteEmailDisabledMsg)
    }
    if (!address && !address_id) {
        throw new Error(msgs.RequiredFieldMsg)
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
        throw new Error(msgs.AddressNotFoundMsg);
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
    const { success: sendboxSuccess } = await c.env.DB.prepare(
        `DELETE FROM sendbox WHERE address = ? `
    ).bind(address).run();
    const { success: addressSuccess } = await c.env.DB.prepare(
        `DELETE FROM users_address WHERE address_id = ? `
    ).bind(address_id).run();
    const { success: autoReplySuccess } = await c.env.DB.prepare(
        `DELETE FROM auto_reply_mails WHERE address = ? `
    ).bind(address).run();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address WHERE name = ? `
    ).bind(address).run();
    if (!success || !mailSuccess || !sendboxSuccess || !addressSuccess || !sendAccess || !autoReplySuccess) {
        throw new Error(msgs.OperationFailedMsg)
    }
    return true;
}

export const handleListQuery = async (
    c: Context<HonoCustomType>,
    query: string, countQuery: string, params: string[],
    limit: string | number | undefined | null,
    offset: string | number | undefined | null,
    /** Must be pre-validated (e.g. whitelist), NOT raw user input. Interpolated directly into SQL. */
    orderBy?: string
): Promise<Response> => {
    const msgs = i18n.getMessagesbyContext(c);
    if (typeof limit === "string") {
        limit = parseInt(limit);
    }
    if (typeof offset === "string") {
        offset = parseInt(offset);
    }
    if (!limit || limit < 0 || limit > 100) {
        return c.text(msgs.InvalidLimitMsg, 400)
    }
    if (offset == null || offset == undefined || offset < 0) {
        return c.text(msgs.InvalidOffsetMsg, 400)
    }
    const orderClause = orderBy || 'id desc';
    const resultsQuery = `${query} order by ${orderClause} limit ? offset ?`;
    const { results } = await c.env.DB.prepare(resultsQuery).bind(
        ...params, limit, offset
    ).all();
    const count = offset == 0 ? await c.env.DB.prepare(
        countQuery
    ).bind(...params).first("count") : 0;
    return c.json({ results, count });
}

/**
 * handleListQuery variant for raw_mails: resolves raw_blob → raw after query.
 */
export const handleMailListQuery = async (
    c: Context<HonoCustomType>,
    query: string, countQuery: string, params: string[],
    limit: string | number | undefined | null,
    offset: string | number | undefined | null,
    orderBy?: string
): Promise<Response> => {
    const { resolveRawEmailList } = await import('./gzip');
    const msgs = i18n.getMessagesbyContext(c);
    if (typeof limit === "string") limit = parseInt(limit);
    if (typeof offset === "string") offset = parseInt(offset);
    if (!limit || limit < 0 || limit > 100) return c.text(msgs.InvalidLimitMsg, 400);
    if (offset == null || offset == undefined || offset < 0) return c.text(msgs.InvalidOffsetMsg, 400);
    const orderClause = orderBy || 'id desc';
    const resultsQuery = `${query} order by ${orderClause} limit ? offset ?`;
    const { results } = await c.env.DB.prepare(resultsQuery).bind(
        ...params, limit, offset
    ).all();
    const resolvedResults = await resolveRawEmailList(results);
    const count = offset == 0 ? await c.env.DB.prepare(
        countQuery
    ).bind(...params).first("count") : 0;
    return c.json({ results: resolvedResults, count });
}

export const commonParseMail = async (parsedEmailContext: ParsedEmailContext): Promise<{
    sender: string,
    subject: string,
    text: string,
    html: string,
    headers?: Record<string, string>[],
    attachments?: ParsedEmailAttachment[],
} | undefined> => {
    // check parsed email context is valid
    if (!parsedEmailContext || !parsedEmailContext.rawEmail) {
        return undefined;
    }
    // return parsed email if already parsed
    if (parsedEmailContext.parsedEmail) {
        return parsedEmailContext.parsedEmail;
    }
    const raw_mail = parsedEmailContext.rawEmail;
    // NOTE: WASM parse email
    // try {
    //     const { parse_message_wrapper } = await import('mail-parser-wasm-worker');

    //     const parsedEmail = parse_message_wrapper(raw_mail);
    //     parsedEmailContext.parsedEmail = {
    //         sender: parsedEmail.sender || "",
    //         subject: parsedEmail.subject || "",
    //         text: parsedEmail.text || "",
    //         headers: parsedEmail.headers?.map(
    //             (header) => ({ key: header.key, value: header.value })
    //         ) || [],
    //         html: parsedEmail.body_html || "",
    //         attachments: (parsedEmail.attachments || []).map(att => ({
    //             filename: att.filename || "attachment",
    //             mimeType: att.content_type || "application/octet-stream",
    //             content: att.content,
    //             disposition: "attachment",
    //         })),
    //     };
    //     return parsedEmailContext.parsedEmail;
    // } catch (e) {
    //     console.error("Failed use mail-parser-wasm-worker to parse email", e);
    // }
    try {
        const { default: PostalMime } = await import('postal-mime');
        const parsedEmail = await PostalMime.parse(raw_mail);
        parsedEmailContext.parsedEmail = {
            sender: parsedEmail.from ? `${parsedEmail.from.name} <${parsedEmail.from.address}>` : "",
            subject: parsedEmail.subject || "",
            text: parsedEmail.text || "",
            html: parsedEmail.html || "",
            headers: parsedEmail.headers || [],
            attachments: (parsedEmail.attachments || []).map(att => ({
                filename: att.filename || "attachment",
                mimeType: att.mimeType || "application/octet-stream",
                content: new Uint8Array(att.content),
                disposition: att.disposition || "attachment",
            })),
        };
        return parsedEmailContext.parsedEmail;
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
        return getStringValue(c.env.PREFIX);
    }
    const user_role = await commonGetUserRole(c, user.user_id);
    if (typeof user_role?.prefix === "string") {
        return user_role.prefix;
    }
    return getStringValue(c.env.PREFIX);
}

export const getAllowDomains = async (c: Context<HonoCustomType>): Promise<string[]> => {
    const user = c.get("userPayload");
    if (!user) {
        return getDefaultDomains(c);
    }
    const user_role = await commonGetUserRole(c, user.user_id);
    const roleDomains = user_role?.domains;
    return roleDomains && roleDomains.length > 0 ? roleDomains : getDefaultDomains(c);
}

export async function sendWebhook(
    settings: WebhookSettings, formatMap: WebhookMail
): Promise<{ success: boolean, message?: string }> {
    // send webhook
    let body = settings.body;
    for (const key of Object.keys(formatMap)) {
        body = body.replace(
            new RegExp(`\\$\\{${key}\\}`, "g"),
            JSON.stringify(
                formatMap[key as keyof WebhookMail]
            ).replace(/^"(.*)"$/, '$1')
        );
    }
    const response = await fetch(settings.url, {
        method: settings.method,
        headers: JSON.parse(settings.headers),
        body: body
    });
    if (!response.ok) {
        console.log("send webhook error", settings.url, settings.method, settings.headers, body);
        console.log("send webhook error", response.status, response.statusText);
        return { success: false, message: `send webhook error: ${response.status} ${response.statusText}` };
    }
    return { success: true }
}

export async function triggerWebhook(
    c: Context<HonoCustomType>,
    address: string,
    parsedEmailContext: ParsedEmailContext,
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
    if (!adminSettings?.enableAllowList || adminSettings?.allowList.includes(address)) {
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

    const parsedEmail = await commonParseMail(parsedEmailContext);
    const webhookMail = {
        id: mailId || "",
        url: c.env.FRONTEND_URL ? `${c.env.FRONTEND_URL}?mail_id=${mailId}` : "",
        from: parsedEmail?.sender || "",
        to: address,
        subject: parsedEmail?.subject || "",
        raw: parsedEmailContext.rawEmail || "",
        parsedText: parsedEmail?.text || "",
        parsedHtml: parsedEmail?.html || "",
    }
    for (const settings of webhookList) {
        const res = await sendWebhook(settings, webhookMail);
        if (!res.success) {
            console.error(res.message);
        }
    }
}

export async function triggerAnotherWorker(
    c: Context<HonoCustomType>,
    rpcEmailMessage: RPCEmailMessage,
    parsedText: string | undefined | null
): Promise<void> {
    if (!parsedText) {
        return;
    }

    const anotherWorkerList: AnotherWorker[] = getAnotherWorkerList(c);
    if (!getBooleanValue(c.env.ENABLE_ANOTHER_WORKER) || anotherWorkerList.length === 0) {
        return;
    }

    const parsedTextLowercase: string = parsedText.toLowerCase();
    for (const worker of anotherWorkerList) {

        const keywords = worker?.keywords ?? [];
        const bindingName = worker?.binding ?? "";
        const methodName = worker.method ?? "rpcEmail";

        const serviceBinding = (c.env as any)[bindingName] ?? {};
        const method = serviceBinding[methodName];

        if (!method || typeof method !== "function") {
            console.log(`method = ${methodName} not found or not function`);
            continue;
        }

        if (!keywords.some(keyword => keyword && parsedTextLowercase.includes(keyword.toLowerCase()))) {
            console.log(`worker.binding = ${bindingName} not match keywords, parsedText = ${parsedText}`);
            continue;
        }
        try {
            const bodyObj = { ...rpcEmailMessage } as any;
            if (bodyObj.headers && typeof bodyObj.headers.forEach === "function") {
                const headerObj: any = {}
                bodyObj.headers.forEach((value: string, key: string) => {
                    headerObj[key] = value;
                });
                bodyObj.headers = headerObj
            }
            const requestBody = JSON.stringify(bodyObj);
            console.log(`exec worker , binding = ${bindingName} , requestBody = ${requestBody}`);
            await method(requestBody);
        } catch (e1) {
            console.error(`execute method = ${methodName} error`, e1);
        }
    }
}
