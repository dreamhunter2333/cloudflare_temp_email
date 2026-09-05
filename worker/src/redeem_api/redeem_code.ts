import { Context, Next } from 'hono';

import { generateRandomName, newAddress as createAddress } from '../common';
import i18n from '../i18n';
import { ensureDefaultSendBalance } from '../mails_api/send_balance';
import {
    getBooleanValue,
    getIntValue,
    getStringValue,
    getUserRoles,
    getJsonObjectValue,
    trimLower,
} from '../utils';

export enum RedeemType {
    Role = 'role',
    SendBalance = 'send_balance',
    AddressPrefixOnce = 'address_prefix_once',
}

export type RedeemValue =
    | { type: RedeemType.Role, role: string }
    | { type: RedeemType.SendBalance, amount: number }
    | { type: RedeemType.AddressPrefixOnce, prefix: string };

export type RedeemCodeRow = {
    id: number,
    code: string,
    redeem_type: string,
    value: string,
    redeemed: 0 | 1,
    result: string | null,
};

export type RoleRedeemResult = {
    type: RedeemType.Role,
    user_id: number,
    user_email: string,
    role: string,
};

export type SendBalanceRedeemResult = {
    type: RedeemType.SendBalance,
    address: string,
    amount: number,
};

export type AddressRedeemResult = {
    type: RedeemType.AddressPrefixOnce,
    address: string,
    address_id: number,
    jwt: string,
    password?: string | null,
};

export const isRedeemType = (value: unknown): value is RedeemType => (
    typeof value === 'string' && Object.values(RedeemType).some((type) => type === value)
);

const RESULT_ENCRYPTION_PREFIX = 'enc:v1:';
let cachedResultKey: { secret: string, key: Promise<CryptoKey> } | null = null;

const encodeBase64Url = (value: Uint8Array): string => {
    let binary = '';
    for (const byte of value) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeBase64Url = (value: string): Uint8Array => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const getResultEncryptionKey = async (c: Context<HonoCustomType>): Promise<CryptoKey> => {
    if (cachedResultKey?.secret === c.env.JWT_SECRET) return await cachedResultKey.key;
    const secret = c.env.JWT_SECRET;
    const key = crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`redeem-result:${secret}`),
    ).then((keyBytes) => (
        crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
    ));
    cachedResultKey = { secret, key };
    return await key;
};

const getResultAdditionalData = (rowId: number): Uint8Array => (
    new TextEncoder().encode(`redeem-result:${rowId}`)
);

export const encryptRedeemResult = async (
    c: Context<HonoCustomType>,
    rowId: number,
    value: string,
): Promise<string> => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({
        name: 'AES-GCM',
        iv,
        additionalData: getResultAdditionalData(rowId),
    }, await getResultEncryptionKey(c), new TextEncoder().encode(value));
    return `${RESULT_ENCRYPTION_PREFIX}${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
};

export const decryptRedeemResult = async (
    c: Context<HonoCustomType>,
    rowId: number,
    value: string | null,
): Promise<string | null> => {
    if (!value) return value;
    try {
        if (!value.startsWith(RESULT_ENCRYPTION_PREFIX)) return null;
        const [ivValue, encryptedValue, ...extra] = value.slice(RESULT_ENCRYPTION_PREFIX.length).split('.');
        if (!ivValue || !encryptedValue || extra.length) return null;
        const decrypted = await crypto.subtle.decrypt({
            name: 'AES-GCM',
            iv: decodeBase64Url(ivValue),
            additionalData: getResultAdditionalData(rowId),
        }, await getResultEncryptionKey(c), decodeBase64Url(encryptedValue));
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.warn(`Failed to decrypt redemption result ${rowId}`, error);
        return null;
    }
};

export const parseRedeemValue = (
    c: Context<HonoCustomType>,
    redeemType: RedeemType,
    value: string,
): RedeemValue | null => {
    const normalizedValue = redeemType === RedeemType.AddressPrefixOnce ? trimLower(value) : value.trim();
    if (redeemType === RedeemType.Role && normalizedValue
        && normalizedValue !== c.env.ADMIN_USER_ROLE
        && getUserRoles(c).some((item) => item.role === normalizedValue)
    ) {
        return { type: RedeemType.Role, role: normalizedValue };
    }
    if (redeemType === RedeemType.SendBalance && /^\d+$/.test(normalizedValue)) {
        const amount = Number(normalizedValue);
        if (amount > 0 && amount <= 1_000_000_000) {
            return { type: RedeemType.SendBalance, amount };
        }
    }
    if (redeemType === RedeemType.AddressPrefixOnce) {
        const maxAddressLength = Math.max(getIntValue(c.env.MAX_ADDRESS_LEN, 30), 1);
        if (normalizedValue.length < maxAddressLength && /^[a-z0-9]*$/.test(normalizedValue)) {
            return { type: RedeemType.AddressPrefixOnce, prefix: normalizedValue };
        }
    }
    return null;
};

export const stringifyRedeemValue = (value: RedeemValue): string => {
    if (value.type === RedeemType.Role) return value.role;
    if (value.type === RedeemType.SendBalance) return String(value.amount);
    return value.prefix;
};

export const normalizeRedeemCode = (code: unknown): string | null => {
    if (typeof code !== 'string') return null;
    const normalizedCode = code.trim();
    return normalizedCode && normalizedCode.length <= 256 ? normalizedCode : null;
};

export const getRedeemCodeForRedemption = async (
    c: Context<HonoCustomType>,
    code: unknown,
): Promise<{ row: RedeemCodeRow, redeemValue: RedeemValue } | Response> => {
    const msgs = i18n.getMessagesbyContext(c);
    const normalizedCode = normalizeRedeemCode(code);
    if (!normalizedCode) return c.text(msgs.RedeemCodeUnavailableMsg, 400);
    const row = await c.env.DB.prepare(
        `SELECT id, code, redeem_type, value, redeemed, result
         FROM redeem_codes
         WHERE code = ? AND enabled = 1
         AND datetime(expires_at) > datetime('now')`
    ).bind(normalizedCode).first<RedeemCodeRow>();
    if (!row) return c.text(msgs.RedeemCodeUnavailableMsg, 400);
    if (!isRedeemType(row.redeem_type)) return c.text(msgs.RedeemCodeInvalidMsg, 400);
    const redeemValue = parseRedeemValue(c, row.redeem_type, row.value);
    if (!redeemValue) return c.text(msgs.RedeemCodeInvalidMsg, 400);
    if (row.redeemed && redeemValue.type !== RedeemType.AddressPrefixOnce) {
        return c.text(msgs.RedeemCodeUnavailableMsg, 400);
    }
    return { row, redeemValue };
};

export const requireRedeemCodeEnabled = async (
    c: Context<HonoCustomType>,
    next: Next,
) => {
    if (!getBooleanValue(c.env.ENABLE_REDEEM_CODE)) return c.notFound();
    await next();
};

type RedeemCodeInput = {
    code?: unknown,
    user_email?: unknown,
    address?: unknown,
    name?: string,
    domain?: string,
    enableRandomSubdomain?: boolean | string,
};

const redeemRole = async (
    c: Context<HonoCustomType>,
    userEmail: unknown,
    row: RedeemCodeRow,
    redeemValue: Extract<RedeemValue, { type: RedeemType.Role }>,
) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (typeof userEmail !== 'string' || !userEmail.trim()) {
        return c.text(msgs.UserNotFoundMsg, 400);
    }
    const user = await c.env.DB.prepare(
        `SELECT id, user_email FROM users WHERE user_email = ? COLLATE NOCASE`
    ).bind(userEmail.trim()).first<{ id: number, user_email: string }>();
    if (!user) return c.text(msgs.UserNotFoundMsg, 400);
    const currentRole = await c.env.DB.prepare(
        `SELECT role_text FROM user_roles WHERE user_id = ?`
    ).bind(user.id).first<string>('role_text');
    const defaultRole = getStringValue(c.env.USER_DEFAULT_ROLE);
    if (currentRole && currentRole !== redeemValue.role && currentRole !== defaultRole) {
        return c.text(msgs.RedeemRoleConflictMsg, 409);
    }
    const redemptionResult: RoleRedeemResult = {
        type: redeemValue.type,
        user_id: user.id,
        user_email: user.user_email,
        role: redeemValue.role,
    };
    const encryptedResult = await encryptRedeemResult(c, row.id, JSON.stringify(redemptionResult));
    const results = await c.env.DB.batch([
        c.env.DB.prepare(
            `UPDATE redeem_codes
             SET result = ?
             WHERE id = ? AND code = ? AND redeem_type = ? AND value = ?
             AND enabled = 1 AND redeemed = 0
             AND datetime(expires_at) > datetime('now')`
        ).bind(
            encryptedResult, row.id, row.code, row.redeem_type, row.value,
        ),
        // changes() refers to the preceding write in this batch.
        c.env.DB.prepare(
            `INSERT INTO user_roles(user_id, role_text)
             SELECT ?, ? WHERE changes() = 1
             ON CONFLICT(user_id) DO UPDATE SET
             role_text = excluded.role_text, updated_at = datetime('now')
             WHERE user_roles.role_text IS NULL OR user_roles.role_text = ''
             OR user_roles.role_text = excluded.role_text OR user_roles.role_text = ?`
        ).bind(user.id, redeemValue.role, defaultRole),
        c.env.DB.prepare(
            `UPDATE redeem_codes
             SET redeemed = 1, redeemed_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ? AND result = ? AND redeemed = 0 AND changes() = 1`
        ).bind(row.id, encryptedResult),
        c.env.DB.prepare(
            `UPDATE redeem_codes SET result = NULL
             WHERE id = ? AND result = ? AND redeemed = 0`
        ).bind(row.id, encryptedResult),
    ]);
    if ((results[2].meta.changes ?? 0) !== 1) {
        return c.text(msgs.RedeemCodeUnavailableMsg, 409);
    }
    return c.json({
        success: true,
        type: redeemValue.type,
        role: redeemValue.role,
        user_email: user.user_email,
    });
};

const redeemSendBalance = async (
    c: Context<HonoCustomType>,
    rawAddress: unknown,
    row: RedeemCodeRow,
    redeemValue: Extract<RedeemValue, { type: RedeemType.SendBalance }>,
) => {
    const address = trimLower(rawAddress);
    const msgs = i18n.getMessagesbyContext(c);
    if (!address) return c.text(msgs.AddressNotFoundMsg, 400);
    const addressExists = await c.env.DB.prepare(
        `SELECT id FROM address WHERE name = ?`
    ).bind(address).first<number>('id');
    if (!addressExists) return c.text(msgs.AddressNotFoundMsg, 400);
    await ensureDefaultSendBalance(c, address);

    const redemptionResult: SendBalanceRedeemResult = {
        type: redeemValue.type,
        address,
        amount: redeemValue.amount,
    };
    const encryptedResult = await encryptRedeemResult(c, row.id, JSON.stringify(redemptionResult));
    const results = await c.env.DB.batch([
        c.env.DB.prepare(
            `UPDATE redeem_codes
             SET redeemed = 1, redeemed_at = datetime('now'), result = ?, updated_at = datetime('now')
             WHERE id = ? AND code = ? AND redeem_type = ? AND value = ?
             AND enabled = 1 AND redeemed = 0
             AND datetime(expires_at) > datetime('now')`
        ).bind(encryptedResult, row.id, row.code, row.redeem_type, row.value),
        c.env.DB.prepare(
            `INSERT INTO address_sender(address, balance, enabled)
             SELECT ?, ?, 1 WHERE changes() = 1
             ON CONFLICT(address) DO UPDATE SET
             balance = COALESCE(address_sender.balance, 0) + excluded.balance`
        ).bind(address, redeemValue.amount),
    ]);
    if ((results[0].meta.changes ?? 0) !== 1 || (results[1].meta.changes ?? 0) !== 1) {
        return c.text(msgs.RedeemCodeUnavailableMsg, 409);
    }
    const balance = await c.env.DB.prepare(
        `SELECT balance FROM address_sender WHERE address = ?`
    ).bind(address).first<number>('balance');
    return c.json({
        success: true,
        type: redeemValue.type,
        address,
        amount: redeemValue.amount,
        balance,
    });
};

const claimRedeemedAddress = async (
    c: Context<HonoCustomType>,
    row: RedeemCodeRow,
    result: AddressRedeemResult,
) => {
    const encryptedResult = await encryptRedeemResult(c, row.id, JSON.stringify(result));
    return await c.env.DB.prepare(
        `UPDATE redeem_codes
         SET redeemed = 1, redeemed_at = datetime('now'), result = ?, updated_at = datetime('now')
         WHERE id = ? AND code = ? AND redeem_type = ? AND value = ?
         AND enabled = 1 AND redeemed = 0
         AND datetime(expires_at) > datetime('now')`
    ).bind(encryptedResult, row.id, row.code, row.redeem_type, row.value).run();
};

export const getRedeemedAddress = async (
    c: Context<HonoCustomType>,
    row: Pick<RedeemCodeRow, 'id' | 'result'>,
): Promise<AddressRedeemResult | null> => {
    const result = await decryptRedeemResult(c, row.id, row.result);
    const context = getJsonObjectValue<AddressRedeemResult>(result);
    if (context?.type !== RedeemType.AddressPrefixOnce
        || typeof context.address !== 'string'
        || typeof context.address_id !== 'number'
        || typeof context.jwt !== 'string'
        || (context.password !== undefined
            && context.password !== null
            && typeof context.password !== 'string')
    ) return null;
    const addressId = await c.env.DB.prepare(
        `SELECT id FROM address WHERE id = ? AND name = ?`
    ).bind(context.address_id, context.address).first<number>('id');
    if (!addressId) return null;
    return context;
};

const redeemAddress = async (
    c: Context<HonoCustomType>,
    body: RedeemCodeInput,
    row: RedeemCodeRow,
    redeemValue: Extract<RedeemValue, { type: RedeemType.AddressPrefixOnce }>,
) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (row.redeemed) {
        const result = await getRedeemedAddress(c, row);
        return result ? c.json(result) : c.text(msgs.RedeemCodeUnavailableMsg, 400);
    }
    const maxNameLength = Math.max(
        getIntValue(c.env.MAX_ADDRESS_LEN, 30) - redeemValue.prefix.length,
        1,
    );
    const name = !body.name || getBooleanValue(c.env.DISABLE_CUSTOM_ADDRESS_NAME)
        ? generateRandomName(c).slice(0, maxNameLength)
        : body.name;
    const sourceMeta = `redeem:${row.id}`;
    let created: Awaited<ReturnType<typeof createAddress>>;
    try {
        created = await createAddress(c, {
            name: `${redeemValue.prefix}${name}`,
            domain: body.domain,
            enablePrefix: false,
            enableRandomSubdomain: getBooleanValue(body.enableRandomSubdomain),
            checkLengthByConfig: true,
            addressPrefix: null,
            sourceMeta,
        });
    } catch (error) {
        const latest = await getRedeemCodeForRedemption(c, body.code);
        if (!(latest instanceof Response)) {
            const concurrentAddress = await getRedeemedAddress(c, latest.row);
            if (concurrentAddress) return c.json(concurrentAddress);
        }
        return c.text(`${msgs.FailedCreateAddressMsg}: ${(error as Error).message}`, 400);
    }

    try {
        const redemptionResult: AddressRedeemResult = { type: redeemValue.type, ...created };
        const claimed = await claimRedeemedAddress(c, row, redemptionResult);
        if ((claimed.meta.changes ?? 0) === 1) return c.json(redemptionResult);
    } catch (error) {
        await c.env.DB.prepare(
            `DELETE FROM address WHERE id = ? AND name = ?`
        ).bind(created.address_id, created.address).run();
        throw error;
    }

    await c.env.DB.prepare(
        `DELETE FROM address WHERE id = ? AND name = ?`
    ).bind(created.address_id, created.address).run();
    const latest = await getRedeemCodeForRedemption(c, body.code);
    if (latest instanceof Response) return latest;
    const concurrentAddress = await getRedeemedAddress(c, latest.row);
    return concurrentAddress
        ? c.json(concurrentAddress)
        : c.text(msgs.RedeemCodeUnavailableMsg, 409);
};

const redeemCode = async (c: Context<HonoCustomType>) => {
    const body = await c.req.json<RedeemCodeInput>().catch(() => null);
    if (!body) return c.text(i18n.getMessagesbyContext(c).RedeemCodeInvalidMsg, 400);
    const result = await getRedeemCodeForRedemption(c, body.code);
    if (result instanceof Response) return result;

    const { row, redeemValue } = result;
    if (redeemValue.type === RedeemType.Role) {
        return await redeemRole(c, body.user_email, row, redeemValue);
    }
    if (redeemValue.type === RedeemType.SendBalance) {
        return await redeemSendBalance(c, body.address, row, redeemValue);
    }
    return await redeemAddress(c, body, row, redeemValue);
};

export default {
    requireRedeemCodeEnabled,
    redeemCode,
};
