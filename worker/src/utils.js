import { createMimeMessage } from "mimetext";

export const getJsonSetting = async (c, key) => {
    const value = await getSetting(c, key);
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value);
    } catch (e) {
        console.error(`GetJsonSetting: Failed to parse ${key}`, e);
    }
    return null;
}

export const getSetting = async (c, key) => {
    try {
        const value = await c.env.DB.prepare(
            `SELECT value FROM settings where key = ?`
        ).bind(key).first("value");
        return value;
    } catch (error) {
        console.error(`GetSetting: Failed to get ${key}`, error);
    }
    return null;
}

export const saveSetting = async (c, key, value) => {
    await c.env.DB.prepare(
        `INSERT or REPLACE INTO settings (key, value) VALUES (?, ?)`
        + ` ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`
    ).bind(key, value, value).run();
    return true;
}

export const getStringValue = (value) => {
    if (typeof value === "string") {
        return value;
    }
    return "";
}

export const getBooleanValue = (value) => {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        return value === "true";
    }
    console.error(`Failed to parse boolean value: ${value}`);
    return false;
}

export const getIntValue = (value, defaultValue = 0) => {
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

export const getDomains = (c) => {
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

export const getPasswords = (c) => {
    if (!c.env.PASSWORDS) {
        return [];
    }
    // check if PASSWORDS is an array, if not use json.parse
    if (!Array.isArray(c.env.PASSWORDS)) {
        try {
            let res = JSON.parse(c.env.PASSWORDS);
            return res.filter((item) => item.length > 0);
        } catch (e) {
            console.error("Failed to parse PASSWORDS", e);
            return [];
        }
    }
    return c.env.PASSWORDS.filter((item) => item.length > 0);
}

export const getAdminPasswords = (c) => {
    if (!c.env.ADMIN_PASSWORDS) {
        return [];
    }
    // check if ADMIN_PASSWORDS is an array, if not use json.parse
    if (!Array.isArray(c.env.ADMIN_PASSWORDS)) {
        try {
            return JSON.parse(c.env.ADMIN_PASSWORDS);
        } catch (e) {
            console.error("Failed to parse ADMIN_PASSWORDS", e);
            return [];
        }
    }
    return c.env.ADMIN_PASSWORDS;
}

export const sendAdminInternalMail = async (c, toMail, subject, text) => {
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

export const checkCfTurnstile = async (c, token) => {
    if (!c.env.CF_TURNSTILE_SITE_KEY) {
        return;
    }
    if (!token) {
        throw new Error("Captcha token is required");
    }
    const reqIp = c.req.raw.headers.get("cf-connecting-ip")
    let formData = new FormData();
    formData.append('secret', c.env.CF_TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', reqIp);
    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(url, {
        body: formData,
        method: 'POST',
    });
    const captchaRes = await result.json();
    if (!captchaRes.success) {
        console.log("Captcha failed", captchaRes);
        throw new Error("Captcha failed");
    }
}

export const checkUserPassword = (password) => {
    if (!password || password.length < 1 || password.length > 100) {
        throw new Error("Invalid password")
    }
    return true;
}
