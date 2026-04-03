/**
 * Gzip compression/decompression utilities for D1 BLOB storage.
 * Uses Web Standard CompressionStream/DecompressionStream (native in CF Workers).
 */

export async function compressText(text: string): Promise<ArrayBuffer> {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
}

export async function decompressBlob(buffer: ArrayBuffer): Promise<string> {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
}

type RawMailRow = Record<string, any>;

/**
 * Resolve the raw email text from either raw_blob (gzip) or raw (plaintext) field.
 */
export async function resolveRawEmail(row: RawMailRow): Promise<string> {
    if (row.raw_blob) {
        // D1 returns BLOB as Array<number>, convert to ArrayBuffer for decompression
        return decompressBlob(new Uint8Array(row.raw_blob).buffer);
    }
    return row.raw ?? '';
}

/**
 * Resolve a single row: decompress raw_blob if present, strip raw_blob from result.
 */
export async function resolveRawEmailRow(row: RawMailRow): Promise<RawMailRow> {
    const raw = await resolveRawEmail(row);
    const { raw_blob: _, ...rest } = row;
    return { ...rest, raw };
}

/**
 * Batch resolve raw emails for list queries using Promise.all.
 */
export async function resolveRawEmailList(rows: RawMailRow[]): Promise<RawMailRow[]> {
    return Promise.all(rows.map(row => resolveRawEmailRow(row)));
}
