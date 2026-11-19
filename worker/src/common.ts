import { Context } from 'hono';
import { createAddressToken } from './address_auth';
import { WorkerMailerOptions } from 'worker-mailer';

import { getBooleanValue, getDomains, getStringArray, getIntValue, getUserRoles, getDefaultDomains, getAnotherWorkerList, hashPassword, getJsonObjectValue, getDomainMapValue, isDomainOrSubdomain, normalizeDomains, trimLower } from './utils';
import { unbindTelegramByAddress } from './telegram_api/common';
import { CONSTANTS } from './constants';
import { AdminWebhookSettings, ExtractResult, WebhookMail, WebhookSettings } from './models';
import i18n from './i18n';
import { formatWebhookBody, getWebhookAttachments } from './utils/webhook';
import { compileFilter, type FilterValues } from './utils/filter';
import { commonParseMail } from './utils/mail_parser';
import { isAddressExpiryEnabled, normalizeAddressExpiresAt, shouldRejectExpiryInput } from './utils/address_expiry';
import {
    allowRandomSubdomainForDomain, checkNameBlockList, checkNameRegex, findMatchedAllowedDomain,
    generateRandomSubdomain, getAddressCreationSubdomainMatchStatus, getNameRegex,
} from './utils/address_creation';

const MAX_RANDOM_SUBDOMAIN_ATTEMPTS = 5;

const normalizeDomainValue = (domain: string): string => {
    return trimLower(domain);
}

/**
 * Check if send mail is enabled for a specific domain
 */
export const isSendMailEnabled = (
    c: Context<HonoCustomType>,
    mailDomain: string
): boolean => {
    // Check resend token for domain or global
    const resendEnabled = c.env.RESEND_TOKEN || c.env[
        `RESEND_TOKEN_${mailDomain.replace(/\./g, "_").toUpperCase()}`
    ];
    if (resendEnabled) return true;

    // Check SMTP config for domain
    const smtpConfigMap = getJsonObjectValue<Record<string, WorkerMailerOptions>>(c.env.SMTP_CONFIG);
    if (getDomainMapValue(smtpConfigMap, mailDomain)) return true;

    // Check SEND_MAIL binding
    if (isSendMailBindingEnabled(c, mailDomain)) return true;

    return false;
}

export const isSendMailBindingEnabled = (
    c: Context<HonoCustomType>,
    mailDomain: string
): boolean => {
    if (!c.env.SEND_MAIL) {
        return false;
    }
    const sendMailDomains = normalizeDomains(getStringArray(c.env.SEND_MAIL_DOMAINS));
    if (sendMailDomains.length === 0) {
        return true;
    }
    return sendMailDomains.includes(normalizeDomainValue(mailDomain));
}

/**
 * Check if send mail is enabled for any configured domain
 */
export const isAnySendMailEnabled = (c: Context<HonoCustomType>): boolean => {
    const domains = getDomains(c);
    return domains.some(domain => isSendMailEnabled(c, domain));
}

export function updateAddressUpdatedAt(
    c: Context<HonoCustomType>,
    address: string | undefined | null
): void {
    if (!address) {
        return;
    }
    // Skip activity timestamp writes when activity tracking is disabled.
    if (getBooleanValue(c.env.DISABLE_ADDRESS_UPDATED_AT)) return;
    // update address updated_at asynchronously
    c.executionCtx.waitUntil((async () => {
        try {
            await c.env.DB.prepare(
                `UPDATE address SET updated_at = datetime('now')`
                + ` WHERE name = ?`
                + ` AND (updated_at IS NULL OR updated_at < datetime('now', '-1 day'))`
            ).bind(address).run();
        } catch (e) {
            const errorName = e instanceof Error ? e.name : "UnknownError";
            console.warn("[updateAddressUpdatedAt] failed:", errorName);
        }
    })());
}

export function updateUserAddressesUpdatedAt(
    c: Context<HonoCustomType>,
    userId: number | string | undefined | null
): void {
    if (!userId) {
        return;
    }
    // Apply the same activity tracking switch to bulk updates.
    if (getBooleanValue(c.env.DISABLE_ADDRESS_UPDATED_AT)) return;
    c.executionCtx.waitUntil((async () => {
        try {
            await c.env.DB.prepare(
                `UPDATE address SET updated_at = datetime('now')`
                + ` WHERE id IN (SELECT address_id FROM users_address WHERE user_id = ?)`
                + ` AND (updated_at IS NULL OR updated_at < datetime('now', '-1 day'))`
            ).bind(userId).run();
        } catch (e) {
            const errorName = e instanceof Error ? e.name : "UnknownError";
            console.warn("[updateUserAddressesUpdatedAt] failed:", errorName);
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
    expiresAt: string | number | null,
    msgs: ReturnType<typeof i18n.getMessagesbyContext>
): Promise<void> => {
    const writeExpiry = isAddressExpiryEnabled(c) && expiresAt != null;
    if (writeExpiry) {
        const expiry = normalizeAddressExpiresAt(expiresAt, msgs);
        try {
            const { success } = await c.env.DB.prepare(
                `INSERT INTO address(name, source_meta, expires_at) VALUES(?, ?, ?)`
            ).bind(address, sourceMeta, expiry).run();
            if (success) return;
        } catch (e) {
            if (!(e as Error).message?.includes("source_meta")) throw e;
            const { success } = await c.env.DB.prepare(
                `INSERT INTO address(name, expires_at) VALUES(?, ?)`
            ).bind(address, expiry).run();
            if (success) return;
        }
        throw new Error(msgs.FailedCreateAddressMsg);
    }

    try {
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address(name, source_meta) VALUES(?, ?)`
        ).bind(address, sourceMeta).run();
        if (success) return;
    } catch (e) {
        if (!(e as Error).message?.includes("source_meta")) throw e;
        const { success } = await c.env.DB.prepare(
            `INSERT INTO address(name) VALUES(?)`
        ).bind(address).run();
        if (success) return;
    }
    throw new Error(msgs.FailedCreateAddressMsg);
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
        expiresAt = null,
    }: {
        name: string, domain: string | undefined | null,
        enablePrefix: boolean,
        enableRandomSubdomain?: boolean,
        checkLengthByConfig?: boolean,
        addressPrefix?: string | undefined | null,
        checkAllowDomains?: boolean,
        enableCheckNameRegex?: boolean,
        sourceMeta?: string | undefined | null,
        expiresAt?: string | number | null,
    }
): Promise<{ address: string, jwt: string, password?: string | null, address_id: number }> => {
    const msgs = i18n.getMessagesbyContext(c);
    if (shouldRejectExpiryInput(c, expiresAt)) {
        throw new Error(msgs.AddressExpiryDisabledMsg);
    }
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
        name = trimLower(addressPrefix) + name;
    } else if (enablePrefix) {
        name = trimLower(c.env.PREFIX) + name;
    }
    // check domain
    const allowDomains = checkAllowDomains ? await getAllowDomains(c) : getDomains(c);
    // if domain is not set, select domain based on environment configuration
    if (!domain && allowDomains.length > 0) {
        const createAddressDefaultDomainFirst = getBooleanValue(c.env.CREATE_ADDRESS_DEFAULT_DOMAIN_FIRST);
        if (createAddressDefaultDomainFirst) {
            domain = normalizeDomainValue(allowDomains[0]);
        } else {
            domain = normalizeDomainValue(allowDomains[Math.floor(Math.random() * allowDomains.length)]);
        }
    } else if (typeof domain === "string") {
        domain = normalizeDomainValue(domain);
    }
    const { effectiveEnabled: enableSubdomainMatch } = await getAddressCreationSubdomainMatchStatus(c);
    const allowManualSubdomain = domain
        ? allowDomains.some((baseDomain) =>
            allowRandomSubdomainForDomain(c, baseDomain) && isDomainOrSubdomain(domain, baseDomain))
        : false;
    const matchedAllowDomain = domain
        ? findMatchedAllowedDomain(domain, allowDomains, enableSubdomainMatch || allowManualSubdomain)
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
        const address = `${name}@${addressDomain}`;

        try {
            await insertAddressRecord(c, address, sourceMeta, expiresAt, msgs);
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
            const jwt = await createAddressToken(c, address, address_id);
            return {
                jwt: jwt,
                address: address,
                password: generatedPassword,
                address_id: address_id,
            }
        } catch (e) {
            const message = (e as Error).message;
            if (message === msgs.InvalidExpiresAtMsg || message === msgs.AddressExpiryDisabledMsg) {
                throw e;
            }
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

export const cleanup = async (
    c: Context<HonoCustomType>,
    cleanType: string | undefined | null,
    cleanDays: number | undefined | null
): Promise<boolean> => {
    // Frozen activity timestamps cannot reliably identify inactive addresses.
    if (cleanType === "inactiveAddress" && getBooleanValue(c.env.DISABLE_ADDRESS_UPDATED_AT)) {
        return false;
    }
    const msgs = i18n.getMessagesbyContext(c);
    if (!cleanType || (cleanType !== "expiredAddress" && (typeof cleanDays !== 'number' || cleanDays < 0 || cleanDays > 1000))) {
        throw new Error(msgs.InvalidCleanupConfigMsg)
    }
    let cleanupBatchSize = getIntValue(c.env.CLEANUP_BATCH_SIZE, 3000);
    if (!Number.isInteger(cleanupBatchSize) || cleanupBatchSize < 1 || cleanupBatchSize > 5000) {
        cleanupBatchSize = 3000;
    }
    console.log(`Cleanup ${cleanType} before ${cleanDays} days`);
    switch (cleanType) {
        case "inactiveAddress":
            await batchDeleteAddressWithData(
                c,
                `id IN (`
                + `SELECT id FROM address WHERE updated_at < datetime('now', '-${cleanDays} day') `
                + `ORDER BY updated_at, id LIMIT ${cleanupBatchSize})`
            )
            break;
        case "addressCreated":
            await batchDeleteAddressWithData(
                c,
                `id IN (`
                + `SELECT id FROM address WHERE created_at < datetime('now', '-${cleanDays} day') `
                + `ORDER BY created_at, id LIMIT ${cleanupBatchSize})`
            )
            break;
        case "unboundAddress":
            await batchDeleteAddressWithData(
                c,
                `id IN (`
                + `SELECT a.id FROM address AS a `
                + `WHERE a.created_at < datetime('now', '-${cleanDays} day') `
                + `AND NOT EXISTS (SELECT 1 FROM users_address AS ua WHERE ua.address_id = a.id) `
                + `ORDER BY a.created_at, a.id LIMIT ${cleanupBatchSize})`
            )
            break;
        case "mails":
            await c.env.DB.prepare(`
                DELETE FROM raw_mails WHERE id IN (
                    SELECT id FROM raw_mails
                    WHERE created_at < datetime('now', ?)
                    ORDER BY created_at, id
                    LIMIT ?
                )`
            ).bind(`-${cleanDays} day`, cleanupBatchSize).run();
            break;
        case "mails_unknow":
            await c.env.DB.prepare(`
                DELETE FROM raw_mails WHERE id IN (
                    SELECT rm.id FROM raw_mails AS rm
                    WHERE rm.created_at < datetime('now', ?)
                    AND NOT EXISTS (
                        SELECT 1 FROM address AS a WHERE a.name = rm.address
                    )
                    ORDER BY rm.created_at, rm.id
                    LIMIT ?
                )`
            ).bind(`-${cleanDays} day`, cleanupBatchSize).run();
            break;
        case "sendbox":
            await c.env.DB.prepare(`
                DELETE FROM sendbox WHERE id IN (
                    SELECT id FROM sendbox
                    WHERE created_at < datetime('now', ?)
                    ORDER BY created_at, id
                    LIMIT ?
                )`
            ).bind(`-${cleanDays} day`, cleanupBatchSize).run();
            break;
        case "emptyAddress":
            // Delete addresses that have no emails and were created more than N days ago
            await batchDeleteAddressWithData(
                c,
                `id IN (`
                + `SELECT a.id FROM address AS a `
                + `WHERE a.created_at < datetime('now', '-${cleanDays} day') `
                + `AND NOT EXISTS (SELECT 1 FROM raw_mails AS rm WHERE rm.address = a.name) `
                + `ORDER BY a.created_at, a.id LIMIT ${cleanupBatchSize})`
            )
            break;
        case "expiredAddress": {
            if (!isAddressExpiryEnabled(c)) {
                throw new Error(msgs.AddressExpiryDisabledMsg);
            }
            await cleanupExpiredAddresses(c, cleanupBatchSize);
            break;
        }
        default:
            throw new Error(msgs.InvalidCleanTypeMsg)
    }
    return true;
}

const EXPIRED_KV_OP_BUDGET = 40;
const KV_DELETE_CHUNK_SIZE = 20;
const NO_KV_DELETE_CHUNK_SIZE = 250;

const deleteAddressChunk = async (
    c: Context<HonoCustomType>,
    ids: number[],
): Promise<void> => {
    const safeIds = ids.filter((id) => Number.isSafeInteger(id) && id > 0);
    if (safeIds.length === 0) return;
    const condition = `id IN (${safeIds.join(',')})`;
    await c.env.DB.batch([
        c.env.DB.prepare(`DELETE FROM raw_mails WHERE address IN (SELECT name FROM address WHERE ${condition})`),
        c.env.DB.prepare(`DELETE FROM sendbox WHERE address IN (SELECT name FROM address WHERE ${condition})`),
        c.env.DB.prepare(`DELETE FROM auto_reply_mails WHERE address IN (SELECT name FROM address WHERE ${condition})`),
        c.env.DB.prepare(`DELETE FROM address_sender WHERE address IN (SELECT name FROM address WHERE ${condition})`),
        c.env.DB.prepare(`DELETE FROM users_address WHERE address_id IN (SELECT id FROM address WHERE ${condition})`),
        c.env.DB.prepare(`DELETE FROM address WHERE ${condition}`),
    ]);
};

const cleanupExpiredAddresses = async (
    c: Context<HonoCustomType>,
    cleanupBatchSize: number,
): Promise<void> => {
    const cutoffUtc = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const hasKv = Boolean(c.env.KV);
    const candidateLimit = hasKv ? Math.min(cleanupBatchSize, EXPIRED_KV_OP_BUDGET) : cleanupBatchSize;
    const { results } = await c.env.DB.prepare(
        `SELECT id, name FROM address WHERE expires_at IS NOT NULL AND expires_at <= ? `
        + `ORDER BY expires_at, id LIMIT ?`
    ).bind(cutoffUtc, candidateLimit).all<{ id: number; name: string }>();
    if (!results || results.length === 0) return;

    let kvOps = 0;
    const kvMethods = new Set(['get', 'put', 'delete', 'list']);
    const unbindCtx = hasKv ? {
        env: {
            ...c.env,
            KV: new Proxy(c.env.KV, {
                get(target, prop) {
                    const value = Reflect.get(target, prop, target);
                    if (typeof value !== 'function' || !kvMethods.has(String(prop))) {
                        return typeof value === 'function' ? value.bind(target) : value;
                    }
                    return (...args: unknown[]) => {
                        kvOps += 1;
                        return value.apply(target, args);
                    };
                },
            }),
        },
    } as Context<HonoCustomType> : c;

    const chunkSize = hasKv ? KV_DELETE_CHUNK_SIZE : NO_KV_DELETE_CHUNK_SIZE;
    let firstUnbindError: unknown = null;
    let budgetReached = false;

    for (let i = 0; i < results.length && !budgetReached; i += chunkSize) {
        const chunkRows = results.slice(i, i + chunkSize);
        const readyIds: number[] = [];
        for (const row of chunkRows) {
            if (!Number.isSafeInteger(row?.id) || row.id <= 0 || !row?.name) continue;
            if (hasKv && kvOps >= EXPIRED_KV_OP_BUDGET) {
                budgetReached = true;
                break;
            }
            const opsBefore = kvOps;
            try {
                await unbindTelegramByAddress(unbindCtx, row.name);
                if (hasKv && kvOps === opsBefore) kvOps += 1;
                readyIds.push(row.id);
            } catch (e) {
                if (hasKv && kvOps === opsBefore) kvOps += 1;
                console.warn("Failed to unbind telegram for expired address:", row.name, e);
                firstUnbindError ??= e;
            }
        }
        await deleteAddressChunk(c, readyIds);
    }

    if (firstUnbindError) {
        throw firstUnbindError;
    }
};

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
    orderBy?: string,
    hiddenFields: string[] = []
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
    if (hiddenFields.length === 0) {
        return c.json({ results, count });
    }

    const filteredResults = results.map((row) => hideObjectFields(row, hiddenFields));
    return c.json({ results: filteredResults, count });
}

export const hideObjectFields = <T extends Record<string, unknown>>(
    row: T,
    fields: string[]
): T => {
    const filteredRow = { ...row };
    for (const field of fields) {
        delete filteredRow[field];
    }
    return filteredRow;
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
        return trimLower(c.env.PREFIX);
    }
    const user_role = await commonGetUserRole(c, user.user_id);
    if (typeof user_role?.prefix === "string") {
        return trimLower(user_role.prefix);
    }
    return trimLower(c.env.PREFIX);
}

export const getAllowDomains = async (c: Context<HonoCustomType>): Promise<string[]> => {
    const user = c.get("userPayload");
    if (!user) {
        return getDefaultDomains(c);
    }
    const user_role = await commonGetUserRole(c, user.user_id);
    if (user_role?.domains && user_role.domains.length > 0) {
        return normalizeDomains(user_role.domains);
    }
    return getDefaultDomains(c);
}

export function filterWebhooks(settings: WebhookSettings[], parsedEmail: ParsedEmailContext['parsedEmail'], to: string): WebhookSettings[] {
    return settings.filter(webhook => {
        try {
            return compileWebhookFilter(webhook.filter)(parsedEmail, to);
        } catch (error) {
            console.error('Invalid webhook filter', error);
            return false;
        }
    });
}

export function compileWebhookFilter(filter: unknown): (
    parsedEmail: ParsedEmailContext['parsedEmail'],
    to: string,
) => boolean {
    if (filter === undefined || filter === null) return () => true;
    const headerFields = new Set<string>();
    const match = compileFilter(filter, field => {
        if (field.startsWith('header.')) headerFields.add(field);
        return ['from', 'to', 'subject', 'text', 'html'].includes(field)
            || /^header\.[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/.test(field);
    });
    return (parsedEmail, to) => {
        if (!parsedEmail) throw new Error('Email parsing unavailable for filter');
        const headers = new Map<string, string[]>();
        for (const field of headerFields) headers.set(field.slice(7).toLowerCase(), []);
        for (const header of headerFields.size ? parsedEmail.headers || [] : []) {
            headers.get(header.key.toLowerCase())?.push(header.value);
        }
        const values: FilterValues = {
            from: parsedEmail.sender,
            to,
            subject: parsedEmail.subject,
            text: parsedEmail.text,
            html: parsedEmail.html,
        };
        for (const field of headerFields) {
            values[field] = headers.get(field.slice(7).toLowerCase()) || [];
        }
        return match(values);
    };
}

export async function sendWebhook(
    settings: WebhookSettings, formatMap: WebhookMail
): Promise<{ success: boolean, message?: string }> {
    // send webhook
    const body = formatWebhookBody(settings.body, formatMap);
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
    parsedEmailContext: ParsedEmailContext,
    storedMailId: number | undefined,
    aiExtract?: ExtractResult | null
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
    const parsedEmail = await commonParseMail(parsedEmailContext);
    const matchingWebhooks = filterWebhooks(webhookList, parsedEmail, address);
    if (matchingWebhooks.length === 0) return;
    const mailRow = storedMailId ? await c.env.DB.prepare(
        `SELECT id, address, created_at FROM raw_mails WHERE id = ? AND address = ?`
    ).bind(storedMailId, address).first<{ id: number, address: string, created_at: string }>() : null;
    const mailId = String(mailRow?.id || '');

    const needsAttachments = matchingWebhooks.some(settings => settings.body.includes('${attachment'));
    const attachments = needsAttachments
        ? await getWebhookAttachments(c.env, mailRow, parsedEmail?.attachments) : [];
    const usableAiExtract = aiExtract?.type !== "none" && aiExtract?.result
        ? aiExtract
        : null;
    const webhookMail = {
        id: mailId || "",
        url: c.env.FRONTEND_URL ? `${c.env.FRONTEND_URL}?mail_id=${mailId}` : "",
        attachments,
        from: parsedEmail?.sender || "",
        to: address,
        subject: parsedEmail?.subject || "",
        raw: parsedEmailContext.rawEmail || "",
        parsedText: parsedEmail?.text || "",
        parsedHtml: parsedEmail?.html || "",
        aiExtract: usableAiExtract,
        aiExtractType: usableAiExtract?.type || "",
        aiExtractResult: usableAiExtract?.result || "",
        aiExtractResultText: usableAiExtract?.result_text || "",
    }
    for (const settings of matchingWebhooks) {
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
