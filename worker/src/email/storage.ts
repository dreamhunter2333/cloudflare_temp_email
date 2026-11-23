import { Context } from "hono";
import { createMimeMessage } from "mimetext";

import { compressText } from "../gzip";
import { getBooleanValue } from "../utils";

// D1 limits each string, BLOB and row to 2,000,000 bytes. Larger mail is split
// into raw_mail_chunks rows; this size leaves room for the other columns.
export const RAW_MAIL_CHUNK_BYTES = 1_000_000;

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

let rawMailChunksReady = false;

/**
 * The migration adds raw_chunk_key before it creates raw_mail_chunks,
 * so chunked writes wait until both exist.
 */
const canStoreChunks = async (env: Bindings): Promise<boolean> => {
    if (rawMailChunksReady) return true;
    if (!(await getRawMailTableColumns(env, ['raw_chunk_key'])).has('raw_chunk_key')) return false;
    const { results } = await env.DB.prepare(`PRAGMA table_info(raw_mail_chunks)`).all();
    rawMailChunksReady = results.length > 0;
    return rawMailChunksReady;
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

    const columns = ['source', 'address', 'message_id'];
    const values: unknown[] = [source, address, messageId];
    if (readStatusEnabled && tableColumns.has('is_unread')) {
        columns.push('is_unread');
        values.push(1);
    }
    const content = rawBlob ?? raw;
    // Before the database is migrated, large mail is stored in one row as before
    const chunks = exceedsChunkSize(content) && await canStoreChunks(env)
        ? splitRawMail(content, RAW_MAIL_CHUNK_BYTES)
        : undefined;
    if (!chunks) {
        columns.push(rawBlob ? 'raw_blob' : 'raw');
        values.push(content);
        return insertRawMail(env, columns, values).run();
    }

    // Write the mail row and its chunks in one batch, so a failure stores neither
    const chunkKey = crypto.randomUUID();
    columns.push('raw_chunk_key');
    values.push(chunkKey);
    const [result] = await env.DB.batch([
        insertRawMail(env, columns, values),
        ...chunks.map((chunk, seq) => env.DB.prepare(
            `INSERT INTO raw_mail_chunks (chunk_key, seq, data) VALUES (?, ?, ?)`
        ).bind(chunkKey, seq, chunk)),
    ]);
    return result;
}

const insertRawMail = (env: Bindings, columns: string[], values: unknown[]): D1PreparedStatement => {
    return env.DB.prepare(
        `INSERT INTO raw_mails (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
    ).bind(...values);
}

const exceedsChunkSize = (content: string | ArrayBuffer): boolean => {
    if (typeof content !== 'string') return content.byteLength > RAW_MAIL_CHUNK_BYTES;
    // A UTF-16 code unit takes at most 3 bytes in UTF-8, so short text needs no encoding
    if (content.length * 3 <= RAW_MAIL_CHUNK_BYTES) return false;
    return new TextEncoder().encode(content).byteLength > RAW_MAIL_CHUNK_BYTES;
}

/**
 * Split stored mail content into pieces of at most maxBytes.
 * Text is split between characters and stays text; gzip data stays binary.
 */
export const splitRawMail = (
    content: string | ArrayBuffer, maxBytes: number
): (string | ArrayBuffer)[] => {
    const chunks: (string | ArrayBuffer)[] = [];
    if (typeof content !== 'string') {
        for (let start = 0; start < content.byteLength; start += maxBytes) {
            chunks.push(content.slice(start, start + maxBytes));
        }
        return chunks;
    }
    const encoder = new TextEncoder();
    const buffer = new Uint8Array(maxBytes);
    for (let start = 0; start < content.length;) {
        // encodeInto stops before a character that does not fit, so no character is cut
        const { read } = encoder.encodeInto(content.substring(start, start + maxBytes), buffer);
        chunks.push(content.substring(start, start + read));
        start += read;
    }
    return chunks;
}

export const deleteRawMail = async (
    env: Bindings, mailId: number, address: string
): Promise<void> => {
    try {
        const { success } = await env.DB.prepare(
            `DELETE FROM raw_mails WHERE id = ? AND address = ?`
        ).bind(mailId, address).run();
        if (!success) throw new Error(`Failed to delete mail ${mailId}`);
    } catch (error) {
        console.error("delete mail error", error);
    }
};

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
