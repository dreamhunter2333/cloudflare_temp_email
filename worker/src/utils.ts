import { Context } from "hono";
import { createMimeMessage } from "mimetext";
import { UserSettings, RoleAddressConfig } from "./models";
import { CONSTANTS } from "./constants";
import { compressText } from "./gzip";

export const getJsonObjectValue = <T = any>(
    value: string | any
): T | null => {
    if (value == undefined || value == null) {
        return null;
    }
    if (typeof value === "object") {
        return value as T;
    }
    if (typeof value !== "string") {
        return null;
    }
    try {
        return JSON.parse(value) as T;
    } catch (e) {
        console.error(`GetJsonValue: Failed to parse ${value}`, e);
    }
    return null;
}

export const getJsonSetting = async <T = any>(
    c: Context<HonoCustomType>, key: string
): Promise<T | null> => {
    const value = await getSetting(c, key);
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value) as T;
    } catch (e) {
        console.error(`GetJsonSetting: Failed to parse ${key}`, e);
    }
    return null;
}

export const getSetting = async (
    c: Context<HonoCustomType>, key: string
): Promise<string | null> => {
    try {
        const value = await c.env.DB.prepare(
            `SELECT value FROM settings where key = ?`
        ).bind(key).first<string>("value");
        return value;
    } catch (error) {
        console.error(`GetSetting: Failed to get ${key}`, error);
    }
    return null;
}

export const saveSetting = async (
    c: Context<HonoCustomType>,
    key: string, value: string
) => {
    await c.env.DB.prepare(
        `INSERT or REPLACE INTO settings (key, value) VALUES (?, ?)`
        + ` ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`
    ).bind(key, value, value).run();
    return true;
}

export const getStringValue = (value: any): string => {
    if (typeof value === "string") {
        return value;
    }
    return "";
}

export const getSplitStringListValue = (
    value: any, demiliter: string = ","
): string[] => {
    const valueToSplit = getStringValue(value);
    return valueToSplit.split(demiliter)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
}

export const getBooleanValue = (
    value: boolean | string | any
): boolean => {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        return value === "true";
    }
    return false;
}

export const getIntValue = (
    value: number | string | any,
    defaultValue: number = 0
): number => {
    if (typeof value === "number") {
        return value;
    }
    if (typeof value === "string") {
        try {
            return parseInt(value);
        } catch (e) {
            console.error(`Failed to parse int value: ${value}`);
        }
    }
    return defaultValue;
}

export const getStringArray = (
    value: string | string[] | undefined | null
): string[] => {
    if (!value) {
        return [];
    }
    // check if value is an array, if not use json.parse
    if (!Array.isArray(value)) {
        try {
            return JSON.parse(value);
        } catch (e) {
            console.error("Failed to parse value", e);
            return [];
        }
    }
    return value;
}

export const normalizeDomain = (
    value: string | undefined | null
): string => {
    return getStringValue(value).trim().toLowerCase();
}

export const normalizeDomains = (domains: string[]): string[] => {
    return domains
        .map((domain) => normalizeDomain(domain))
        .filter((domain) => domain.length > 0);
}

export const normalizeEmailAddress = (
    value: string | undefined | null
): string => {
    const address = getStringValue(value).trim();
    if (!address) {
        return "";
    }
    const atIndex = address.lastIndexOf("@");
    if (atIndex < 0) {
        return address;
    }
    const localPart = address.slice(0, atIndex);
    const domain = normalizeDomain(address.slice(atIndex + 1));
    return domain ? `${localPart}@${domain}` : localPart;
}

export const getMailDomain = (
    value: string | undefined | null
): string => {
    const normalizedAddress = normalizeEmailAddress(value);
    const atIndex = normalizedAddress.lastIndexOf("@");
    if (atIndex < 0) {
        return "";
    }
    return normalizedAddress.slice(atIndex + 1);
}

export const includesDomain = (
    domains: string[] | undefined | null,
    domain: string | undefined | null
): boolean => {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain || !domains || domains.length === 0) {
        return false;
    }
    return normalizeDomains(domains).includes(normalizedDomain);
}

export const getDomainMapValue = <T>(
    valueMap: Record<string, T> | undefined | null,
    domain: string | undefined | null
): T | null => {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain || !valueMap) {
        return null;
    }
    for (const [key, value] of Object.entries(valueMap)) {
        if (normalizeDomain(key) === normalizedDomain) {
            return value;
        }
    }
    return null;
}

export const getDefaultDomains = (c: Context<HonoCustomType>): string[] => {
    if (c.env.DEFAULT_DOMAINS == undefined || c.env.DEFAULT_DOMAINS == null) {
        return getDomains(c);
    }
    const domains = normalizeDomains(getStringArray(c.env.DEFAULT_DOMAINS));
    return domains || getDomains(c);
}

export const getDomains = (c: Context<HonoCustomType>): string[] => {
    if (!c.env.DOMAINS) {
        return [];
    }
    // check if DOMAINS is an array, if not use json.parse
    if (!Array.isArray(c.env.DOMAINS)) {
        try {
            return normalizeDomains(JSON.parse(c.env.DOMAINS));
        } catch (e) {
            console.error("Failed to parse DOMAINS", e);
            return [];
        }
    }
    return normalizeDomains(c.env.DOMAINS);
}

export const getRandomSubdomainDomains = (c: Context<HonoCustomType>): string[] => {
    if (!c.env.RANDOM_SUBDOMAIN_DOMAINS) {
        return [];
    }
    return normalizeDomains(getStringArray(c.env.RANDOM_SUBDOMAIN_DOMAINS));
}

export const getUserRoles = (c: Context<HonoCustomType>): UserRole[] => {
    if (!c.env.USER_ROLES) {
        return [];
    }
    const normalizeRoles = (roles: UserRole[]): UserRole[] => {
        return roles.map((role) => ({
            ...role,
            domains: Array.isArray(role.domains)
                ? normalizeDomains(role.domains)
                : role.domains,
        }));
    };
    // check if USER_ROLES is an array, if not use json.parse
    if (!Array.isArray(c.env.USER_ROLES)) {
        try {
            return normalizeRoles(JSON.parse(c.env.USER_ROLES));
        } catch (e) {
            console.error("Failed to parse USER_ROLES", e);
            return [];
        }
    }
    return normalizeRoles(c.env.USER_ROLES);
}

export const getAnotherWorkerList = (c: Context<HonoCustomType>): AnotherWorker[] => {
    if (!c.env.ANOTHER_WORKER_LIST) {
        return [];
    }
    // check if ANOTHER_WORKER_LIST is an array, if not use json.parse
    if (!Array.isArray(c.env.ANOTHER_WORKER_LIST)) {
        try {
            return JSON.parse(c.env.ANOTHER_WORKER_LIST);
        } catch (e) {
            console.error("Failed to parse ANOTHER_WORKER_LIST", e);
            return [];
        }
    }
    return c.env.ANOTHER_WORKER_LIST;
}

export const getPasswords = (c: Context<HonoCustomType>): string[] => {
    if (!c.env.PASSWORDS) {
        return [];
    }
    // check if PASSWORDS is an array, if not use json.parse
    if (!Array.isArray(c.env.PASSWORDS)) {
        try {
            const res = JSON.parse(c.env.PASSWORDS) as string[];
            return res.filter((item) => item.length > 0);
        } catch (e) {
            console.error("Failed to parse PASSWORDS", e);
            return [];
        }
    }
    return c.env.PASSWORDS.filter((item) => item.length > 0);
}

export const getAdminPasswords = (c: Context<HonoCustomType>): string[] => {
    if (!c.env.ADMIN_PASSWORDS) {
        return [];
    }
    // check if ADMIN_PASSWORDS is an array, if not use json.parse
    if (!Array.isArray(c.env.ADMIN_PASSWORDS)) {
        try {
            const res = JSON.parse(c.env.ADMIN_PASSWORDS) as string[];
            return res.filter((item) => item.length > 0);
        } catch (e) {
            console.error("Failed to parse ADMIN_PASSWORDS", e);
            return [];
        }
    }
    return c.env.ADMIN_PASSWORDS.filter((item) => item.length > 0);
}

export const checkIsAdmin = (c: Context<HonoCustomType>): boolean => {
    const adminPasswords = getAdminPasswords(c);
    if (!adminPasswords.length) return false;
    const adminAuth = c.req.raw.headers.get("x-admin-auth");
    return !!adminAuth && adminPasswords.includes(adminAuth);
}

export const getEnvStringList = (value: string | string[] | undefined): string[] => {
    if (!value) {
        return [];
    }
    // check if is an array, if not use json.parse
    if (!Array.isArray(value)) {
        try {
            const res = JSON.parse(value) as string[];
            return res.filter((item) => item.length > 0);
        } catch (e) {
            console.error("Failed to parse ADMIN_PASSWORDS", e);
            return [];
        }
    }
    return value.filter((item) => item.length > 0);
}

export const sendAdminInternalMail = async (
    c: Context<HonoCustomType>, toMail: string, subject: string, text: string
): Promise<boolean> => {
    try {

        const msg = createMimeMessage();
        msg.setSender({
            name: "Admin",
            addr: "admin@internal"
        });
        msg.setRecipient(toMail);
        msg.setSubject(subject);
        msg.addMessage({
            contentType: 'text/plain',
            data: text
        });
        const message_id = Math.random().toString(36).substring(2, 15);
        const rawText = msg.asRaw();
        let success = false;
        if (getBooleanValue(c.env.ENABLE_MAIL_GZIP)) {
            let compressed: ArrayBuffer | null = null;
            try {
                compressed = await compressText(rawText);
            } catch (gzipError) {
                console.error("gzip compression failed, falling back to plaintext", gzipError);
            }
            if (compressed) {
                try {
                    ({ success } = await c.env.DB.prepare(
                        `INSERT INTO raw_mails (source, address, raw_blob, message_id) VALUES (?, ?, ?, ?)`
                    ).bind("admin@internal", toMail, compressed, message_id).run());
                } catch (dbError) {
                    const errMsg = String(dbError);
                    if (errMsg.includes('raw_blob') || errMsg.includes('no such column')) {
                        console.error("raw_blob column missing, falling back to plaintext", dbError);
                        ({ success } = await c.env.DB.prepare(
                            `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
                        ).bind("admin@internal", toMail, rawText, message_id).run());
                    } else {
                        throw dbError;
                    }
                }
            } else {
                ({ success } = await c.env.DB.prepare(
                    `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
                ).bind("admin@internal", toMail, rawText, message_id).run());
            }
        } else {
            ({ success } = await c.env.DB.prepare(
                `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
            ).bind("admin@internal", toMail, rawText, message_id).run());
        }
        if (!success) {
            console.log(`Failed save message from admin@internal to ${toMail}`);
        }
        return success;
    } catch (error) {
        console.log("sendAdminInternalMail error", error);
        return false;
    }
};

export const isGlobalTurnstileEnabled = (c: Context<HonoCustomType>): boolean => {
    return getBooleanValue(c.env.ENABLE_GLOBAL_TURNSTILE_CHECK)
        && !!c.env.CF_TURNSTILE_SITE_KEY
        && !!c.env.CF_TURNSTILE_SECRET_KEY;
}

export const checkCfTurnstile = async (
    c: Context<HonoCustomType>, token: string | undefined | null
): Promise<void> => {
    if (!c.env.CF_TURNSTILE_SITE_KEY || !c.env.CF_TURNSTILE_SECRET_KEY) {
        return;
    }
    if (!token) {
        throw new Error("Captcha token is required");
    }
    const reqIp = c.req.raw.headers.get("cf-connecting-ip");
    const formData = new FormData();
    formData.append('secret', c.env.CF_TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (reqIp) formData.append('remoteip', reqIp);
    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(url, {
        body: formData,
        method: 'POST',
    });
    const captchaRes: any = await result.json();
    if (!captchaRes.success) {
        console.log("Captcha failed", captchaRes);
        throw new Error("Captcha failed");
    }
}

export const checkUserPassword = (password: string) => {
    if (!password || password.length < 1 || password.length > 100) {
        throw new Error("Invalid password")
    }
    return true;
}

export const hashPassword = async (password: string): Promise<string> => {
    // use crypto to hash password
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export const getMaxAddressCount = async (
    c: Context<HonoCustomType>,
    userRole: string | null | undefined,
    settings: UserSettings
): Promise<number> => {
    if (!userRole) return settings.maxAddressCount;
    const roleConfigs = await getJsonSetting<RoleAddressConfig>(c, CONSTANTS.ROLE_ADDRESS_CONFIG_KEY);
    if (!roleConfigs) return settings.maxAddressCount;
    const roleMaxCount = roleConfigs[userRole]?.maxAddressCount;
    if (typeof roleMaxCount !== 'number') return settings.maxAddressCount;
    if (roleMaxCount <= 0) return settings.maxAddressCount;
    return roleMaxCount;
};

/**
 * 检查用户是否已达到地址数量限制
 * @param c - Hono Context
 * @param user_id - 用户 ID
 * @param userRole - 用户角色
 * @returns true 表示已超限，false 表示未超限
 */
export const isAddressCountLimitReached = async (
    c: Context<HonoCustomType>,
    user_id: number | string,
    userRole: string | null | undefined
): Promise<boolean> => {
    const value = await getJsonSetting(c, CONSTANTS.USER_SETTINGS_KEY);
    const settings = new UserSettings(value);
    const maxAddressCount = await getMaxAddressCount(c, userRole, settings);

    if (maxAddressCount <= 0) return false;

    const { count } = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM users_address where user_id = ?`
    ).bind(user_id).first<{ count: number }>() || { count: 0 };

    return count >= maxAddressCount;
};

export default {
    getJsonObjectValue,
    getSetting,
    saveSetting,
    getStringValue,
    getSplitStringListValue,
    getBooleanValue,
    getIntValue,
    getStringArray,
    normalizeDomain,
    normalizeDomains,
    normalizeEmailAddress,
    getMailDomain,
    includesDomain,
    getDomainMapValue,
    getDefaultDomains,
    getDomains,
    getRandomSubdomainDomains,
    getUserRoles,
    getAnotherWorkerList,
    getPasswords,
    getAdminPasswords,
    checkIsAdmin,
    getEnvStringList,
    sendAdminInternalMail,
    isGlobalTurnstileEnabled,
    checkCfTurnstile,
    checkUserPassword,
    getJsonSetting,
    getJsonValue: getJsonObjectValue,
    getStringList: getStringArray
}
