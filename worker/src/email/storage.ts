import { Context } from "hono";
import { createMimeMessage } from "mimetext";

import { compressText } from "../gzip";
import { getBooleanValue } from "../utils";

let rawMailTableColumns: Set<string> | undefined;

const getRawMailTableColumns = async (
    env: Bindings, requiredColumns: string[]
): Promise<Set<string>> => {
    const cachedColumns = rawMailTableColumns;
    if (cachedColumns && requiredColumns.every(column => cachedColumns.has(column))) {
        return cachedColumns;
    }
    const tableInfo = await env.DB.prepare(`PRAGMA table_info(raw_mails)`).all<{ name: string }>();
    const columns = new Set(tableInfo.results.map(column => column.name));
    if (requiredColumns.every(column => columns.has(column))) {
        rawMailTableColumns = columns;
    }
    return columns;
}

export const storeRawMail = async (
    env: Bindings,
    source: string,
    address: string,
    messageId: string | null,
    raw: string,
): Promise<D1Result> => {
    const gzipEnabled = getBooleanValue(env.ENABLE_MAIL_GZIP);
    const readStatusEnabled = getBooleanValue(env.ENABLE_MAIL_READ_STATUS);
    const requiredColumns: string[] = [];
    if (gzipEnabled) requiredColumns.push('raw_blob');
    if (readStatusEnabled) requiredColumns.push('is_unread');

    let tableColumns = new Set<string>();
    if (requiredColumns.length > 0) {
        tableColumns = await getRawMailTableColumns(env, requiredColumns);
    }

    let rawBlob: ArrayBuffer | undefined;
    if (gzipEnabled && tableColumns.has('raw_blob')) {
        try {
            rawBlob = await compressText(raw);
        } catch (error) {
            console.error("gzip compression failed, falling back to plaintext", error);
        }
    }

    const storeUnreadStatus = readStatusEnabled && tableColumns.has('is_unread');
    if (rawBlob) {
        if (!storeUnreadStatus) {
            return env.DB.prepare(
                `INSERT INTO raw_mails (source, address, raw_blob, message_id) VALUES (?, ?, ?, ?)`
            ).bind(source, address, rawBlob, messageId).run();
        }
        return env.DB.prepare(
            `INSERT INTO raw_mails (source, address, raw_blob, message_id, is_unread) VALUES (?, ?, ?, ?, 1)`
        ).bind(source, address, rawBlob, messageId).run();
    }
    if (!storeUnreadStatus) {
        return env.DB.prepare(
            `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
        ).bind(source, address, raw, messageId).run();
    }
    return env.DB.prepare(
        `INSERT INTO raw_mails (source, address, raw, message_id, is_unread) VALUES (?, ?, ?, ?, 1)`
    ).bind(source, address, raw, messageId).run();
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
        const messageId = Math.random().toString(36).substring(2, 15);
        const { success } = await storeRawMail(
            c.env, "admin@internal", toMail, messageId, msg.asRaw()
        );
        if (!success) {
            console.log(`Failed save message from admin@internal to ${toMail}`);
        }
        return success;
    } catch (error) {
        console.log("sendAdminInternalMail error", error);
        return false;
    }
};
