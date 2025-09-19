import { Context } from "hono";
import { createMimeMessage } from "mimetext";

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

export const getDefaultDomains = (c: Context<HonoCustomType>): string[] => {
    if (c.env.DEFAULT_DOMAINS == undefined || c.env.DEFAULT_DOMAINS == null) {
        return getDomains(c);
    }
    const domains = getStringArray(c.env.DEFAULT_DOMAINS);
    return domains || getDomains(c);
}

export const getDomains = (c: Context<HonoCustomType>): string[] => {
    if (!c.env.DOMAINS) {
        return [];
    }
    // check if DOMAINS is an array, if not use json.parse
    if (!Array.isArray(c.env.DOMAINS)) {
        try {
            return JSON.parse(c.env.DOMAINS);
        } catch (e) {
            console.error("Failed to parse DOMAINS", e);
            return [];
        }
    }
    return c.env.DOMAINS;
}

export const getUserRoles = (c: Context<HonoCustomType>): UserRole[] => {
    if (!c.env.USER_ROLES) {
        return [];
    }
    // check if USER_ROLES is an array, if not use json.parse
    if (!Array.isArray(c.env.USER_ROLES)) {
        try {
            return JSON.parse(c.env.USER_ROLES);
        } catch (e) {
            console.error("Failed to parse USER_ROLES", e);
            return [];
        }
    }
    return c.env.USER_ROLES;
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
        const { success } = await c.env.DB.prepare(
            `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
        ).bind(
            "admin@internal", toMail, msg.asRaw(), message_id
        ).run();
        if (!success) {
            console.log(`Failed save message from admin@internal to ${toMail}`);
        }
        return success;
    } catch (error) {
        console.log("sendAdminInternalMail error", error);
        return false;
    }
};

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

export default {
    getJsonObjectValue,
    getSetting,
    saveSetting,
    getStringValue,
    getSplitStringListValue,
    getBooleanValue,
    getIntValue,
    getStringArray,
    getDefaultDomains,
    getDomains,
    getUserRoles,
    getAnotherWorkerList,
    getPasswords,
    getAdminPasswords,
    getEnvStringList,
    sendAdminInternalMail,
    checkCfTurnstile,
    checkUserPassword,
    getJsonSetting,
    getJsonValue: getJsonObjectValue,
    getStringList: getStringArray
}
