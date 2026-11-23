/**
 * Gzip compression/decompression utilities for D1 BLOB storage.
 * Uses Web Standard CompressionStream/DecompressionStream (native in CF Workers).
 */

import { RawMailRow } from "./models";

type RawMailChunk = { seq: number; data: string | ArrayLike<number> };

export async function compressText(text: string): Promise<ArrayBuffer> {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
}

export async function decompressBlob(buffer: ArrayBuffer): Promise<string> {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
}

async function loadRawMailChunks(db: D1Database, chunkKey: string): Promise<RawMailChunk[]> {
    const { results } = await db.prepare(
        `SELECT seq, data FROM raw_mail_chunks WHERE chunk_key = ? ORDER BY seq`
    ).bind(chunkKey).all<RawMailChunk>();
    return results;
}

/**
 * Join the chunks of a large mail: text chunks hold plaintext, BLOB chunks hold gzip data.
 */
async function joinRawMailChunks(chunks: RawMailChunk[]): Promise<string> {
    if (chunks.length === 0 || chunks.some((chunk, index) => chunk.seq !== index)) {
        throw new Error("raw mail chunks are missing or out of order");
    }
    const textChunks = chunks.filter(chunk => typeof chunk.data === 'string');
    if (textChunks.length === chunks.length) {
        return textChunks.map(chunk => chunk.data).join('');
    }
    if (textChunks.length > 0) {
        throw new Error("raw mail chunks mix text and binary data");
    }
    // D1 returns BLOB as Array<number>
    const parts = chunks.map(chunk => new Uint8Array(chunk.data as ArrayLike<number>));
    const bytes = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0));
    let offset = 0;
    for (const part of parts) {
        bytes.set(part, offset);
        offset += part.byteLength;
    }
    return decompressBlob(bytes.buffer);
}

/**
 * Resolve the raw email text from raw_mail_chunks, raw_blob (gzip) or raw (plaintext).
 */
export async function resolveRawEmail(db: D1Database, row: RawMailRow): Promise<string> {
    if (row.raw_chunk_key) {
        try {
            return await joinRawMailChunks(await loadRawMailChunks(db, row.raw_chunk_key));
        } catch (e) {
            console.error(`failed to read the chunks of mail ${row.id}`, e);
            return row.raw ?? '';
        }
    }
    if (row.raw_blob) {
        try {
            // D1 returns BLOB as Array<number>, convert to ArrayBuffer for decompression
            return await decompressBlob(new Uint8Array(row.raw_blob as ArrayLike<number>).buffer);
        } catch (e) {
            console.error("decompressBlob failed, fallback to raw field", e);
            return row.raw ?? '';
        }
    }
    return row.raw ?? '';
}

/**
 * Resolve a single row: read chunks or decompress raw_blob, strip storage fields from result.
 */
export async function resolveRawEmailRow(db: D1Database, row: RawMailRow): Promise<RawMailRow> {
    const raw = await resolveRawEmail(db, row);
    const { raw_blob: _, raw_chunk_key: __, ...rest } = row;
    return { ...rest, raw };
}

/**
 * Resolve raw emails for list queries one at a time, so large mails are not
 * loaded and decompressed at the same time.
 */
export async function resolveRawEmailList(db: D1Database, rows: RawMailRow[]): Promise<RawMailRow[]> {
    const resolved: RawMailRow[] = [];
    for (const row of rows) {
        resolved.push(await resolveRawEmailRow(db, row));
    }
    return resolved;
}
