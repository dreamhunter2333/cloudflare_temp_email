import { createMimeMessage } from "mimetext";

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
            return JSON.parse(c.env.PASSWORDS);
        } catch (e) {
            console.error("Failed to parse PASSWORDS", e);
            return [];
        }
    }
    return c.env.PASSWORDS;
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
