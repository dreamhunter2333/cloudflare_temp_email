import { Context } from 'hono';

import { getJsonObjectValue } from '../utils';
import {
    decryptRedeemResult,
    isRedeemType,
    parseRedeemValue,
    RedeemType,
    requireRedeemCodeEnabled,
    stringifyRedeemValue,
} from './redeem_code';

const MAX_BATCH_SIZE = 500;
const MAX_EXPORT_SIZE = 10_000;

const parsePositiveId = (value: string): number | null => {
    if (!/^\d+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const validateValue = (value: unknown): value is string => (
    typeof value === 'string' && value.length <= 10_000
);

const normalizeExpiresAt = (expiresAt: unknown): string | undefined => {
    if (typeof expiresAt !== 'string' || !expiresAt.trim()) return undefined;
    const timestamp = Date.parse(expiresAt);
    return Number.isFinite(timestamp) && timestamp > Date.now()
        ? new Date(timestamp).toISOString()
        : undefined;
};

const listRedeemCodes = async (c: Context<HonoCustomType>) => {
    const { limit: rawLimit, offset: rawOffset, query, redeem_type } = c.req.query();
    if (!isRedeemType(redeem_type)) {
        return c.text('Invalid redemption code type', 400);
    }
    const parsedLimit = Number.parseInt(rawLimit || '20');
    const parsedOffset = Number.parseInt(rawOffset || '0');
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
    const offset = Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0;
    const search = query?.trim();
    const where = ` WHERE redeem_type = ?`
        + (search ? ` AND code LIKE ?` : '');
    const params = search
        ? [redeem_type, `%${search}%`]
        : [redeem_type];
    const [rows, count] = await Promise.all([
        c.env.DB.prepare(
            `SELECT id, code, redeem_type, value, result, enabled, redeemed,
                    expires_at, redeemed_at, created_at, updated_at
             FROM redeem_codes${where}
             ORDER BY id DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all<{
            id: number,
            redeemed: number,
            result: string | null,
            [key: string]: unknown,
        }>(),
        c.env.DB.prepare(
            `SELECT count(*) AS count FROM redeem_codes${where}`
        ).bind(...params).first<number>('count'),
    ]);
    const results = await Promise.all(rows.results.map(async (row) => ({
        ...row,
        redeemed: row.redeemed === 1,
        result: await decryptRedeemResult(c, row.id, row.result),
    })));
    return c.json({ results, count: count ?? 0 });
}

const createRedeemCodes = async (c: Context<HonoCustomType>) => {
    const body = await c.req.json<{
        count?: unknown,
        redeem_type?: unknown,
        value?: unknown,
        enabled?: unknown,
        expires_at?: unknown,
    }>().catch(() => null);
    if (!body) return c.text('Invalid redemption code data', 400);
    const { count, redeem_type, value, enabled, expires_at } = body;
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1 || count > MAX_BATCH_SIZE
        || !isRedeemType(redeem_type)
        || typeof enabled !== 'boolean'
        || !validateValue(value)
    ) {
        return c.text('Invalid redemption code data', 400);
    }
    const redeemValue = parseRedeemValue(c, redeem_type, value);
    if (!redeemValue) return c.text('Invalid redemption code data', 400);
    const expiresAt = normalizeExpiresAt(expires_at);
    if (expiresAt === undefined) return c.text('Invalid expiration time', 400);
    const normalizedValue = stringifyRedeemValue(redeemValue);

    const codes = Array.from({ length: count }, () => crypto.randomUUID());
    for (let index = 0; index < codes.length; index += 100) {
        await c.env.DB.batch(codes.slice(index, index + 100).map((code) => (
            c.env.DB.prepare(
                `INSERT INTO redeem_codes(code, redeem_type, value, enabled, expires_at)
                 VALUES(?, ?, ?, ?, ?)`
            ).bind(code, redeem_type, normalizedValue, enabled ? 1 : 0, expiresAt)
        )));
    }
    return c.json({ success: true, created: codes.length, codes });
}

const updateRedeemCode = async (c: Context<HonoCustomType>) => {
    const id = parsePositiveId(c.req.param('id'));
    const body = await c.req.json<{
        redeem_type?: unknown,
        value?: unknown,
        enabled?: unknown,
        expires_at?: unknown,
    }>().catch(() => null);
    if (!body) return c.text('Invalid redemption code data', 400);
    const { redeem_type, value, enabled, expires_at } = body;
    if (!id || !isRedeemType(redeem_type) || typeof enabled !== 'boolean'
        || !validateValue(value)
    ) {
        return c.text('Invalid redemption code data', 400);
    }
    const redeemValue = parseRedeemValue(c, redeem_type, value);
    if (!redeemValue) return c.text('Invalid redemption code data', 400);
    const expiresAt = normalizeExpiresAt(expires_at);
    if (expiresAt === undefined) return c.text('Invalid expiration time', 400);
    const normalizedValue = stringifyRedeemValue(redeemValue);
    const result = await c.env.DB.prepare(
        `UPDATE redeem_codes
         SET value = ?, enabled = ?, expires_at = ?, updated_at = datetime('now')
         WHERE id = ? AND redeem_type = ? AND redeemed = 0`
    ).bind(normalizedValue, enabled ? 1 : 0, expiresAt, id, redeem_type).run();
    if ((result.meta.changes ?? 0) !== 1) {
        const redeemedValue = await c.env.DB.prepare(
            `SELECT redeemed FROM redeem_codes WHERE id = ? AND redeem_type = ?`
        ).bind(id, redeem_type).first<number>('redeemed');
        const redeemed = redeemedValue === 1;
        return redeemed
            ? c.text('Redemption code already redeemed', 409)
            : c.text('Redemption code not found', 404);
    }
    return c.json({ success: true });
}

const deleteRedeemCode = async (c: Context<HonoCustomType>) => {
    const id = parsePositiveId(c.req.param('id'));
    if (!id) return c.text('Invalid redemption code id', 400);
    const result = await c.env.DB.prepare(
        `DELETE FROM redeem_codes WHERE id = ?`
    ).bind(id).run();
    if ((result.meta.changes ?? 0) !== 1) return c.text('Redemption code not found', 404);
    return c.json({ success: true });
}

const csvCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

const exportRedeemCodes = async (c: Context<HonoCustomType>) => {
    const { redeem_type, limit: rawLimit } = c.req.query();
    const limit = /^\d+$/.test(rawLimit || '') ? Number(rawLimit) : NaN;
    if (!isRedeemType(redeem_type)) {
        return c.text('Invalid redemption code type', 400);
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_EXPORT_SIZE) {
        return c.text(`Export limit must be between 1 and ${MAX_EXPORT_SIZE}`, 400);
    }
    const rows = await c.env.DB.prepare(
        `SELECT id, code, redeem_type, value, result, enabled, redeemed,
                expires_at, redeemed_at, created_at, updated_at
         FROM redeem_codes
         WHERE redeem_type = ?
         ORDER BY id DESC LIMIT ?`
    ).bind(redeem_type, limit).all<{
        id: number,
        result: string | null,
        [key: string]: unknown,
    }>();
    const businessColumns = redeem_type === RedeemType.Role
        ? ['role', 'redeemed_user_id']
        : redeem_type === RedeemType.SendBalance
            ? ['amount', 'target_address']
            : ['prefix', 'result_address'];
    const columns = [
        'id', 'code', 'redeem_type', ...businessColumns, 'enabled', 'redeemed', 'expires_at',
        'redeemed_at', 'value', 'result', 'created_at', 'updated_at',
    ];
    const exportedRows = await Promise.all(rows.results.map(async (row) => {
        const resultValue = await decryptRedeemResult(c, row.id, row.result);
        const result = getJsonObjectValue<Record<string, unknown>>(resultValue) || {};
        return {
            ...row,
            result: resultValue,
            role: redeem_type === RedeemType.Role ? row.value : undefined,
            redeemed_user_id: result.user_id,
            amount: redeem_type === RedeemType.SendBalance ? row.value : undefined,
            target_address: result.address,
            prefix: redeem_type === RedeemType.AddressPrefixOnce ? row.value : undefined,
            result_address: result.address,
        };
    }));
    const csv = [
        columns.join(','),
        ...exportedRows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
    ].join('\n');
    return new Response(`\uFEFF${csv}`, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="redeem-codes-${redeem_type}.csv"`,
        },
    });
}

export default {
    requireRedeemCodeEnabled,
    listRedeemCodes,
    createRedeemCodes,
    updateRedeemCode,
    deleteRedeemCode,
    exportRedeemCodes,
};
