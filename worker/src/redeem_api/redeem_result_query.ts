import { Context } from 'hono';

import i18n from '../i18n';
import { getJsonObjectValue } from '../utils';
import {
    decryptRedeemResult,
    getRedeemedAddress,
    normalizeRedeemCode,
    RedeemType,
    RoleRedeemResult,
    SendBalanceRedeemResult,
} from './redeem_code';

type RedeemResultRow = {
    id: number,
    redeem_type: string,
    result: string,
};

type RedeemResult = Record<string, unknown> & {
    type: string,
};

const getResultResponse = (result: RedeemResult): Record<string, unknown> | null => {
    if (result.type === RedeemType.Role) {
        const roleResult = result as RoleRedeemResult;
        if (typeof roleResult.user_email !== 'string' || typeof roleResult.role !== 'string') return null;
        return { type: roleResult.type, user_email: roleResult.user_email, role: roleResult.role };
    }
    if (result.type === RedeemType.SendBalance) {
        const balanceResult = result as SendBalanceRedeemResult;
        if (typeof balanceResult.address !== 'string' || typeof balanceResult.amount !== 'number') return null;
        return { type: balanceResult.type, address: balanceResult.address, amount: balanceResult.amount };
    }
    return null;
};

const queryRedeemResult = async (c: Context<HonoCustomType>) => {
    const body = await c.req.json<{ code?: unknown }>().catch(() => null);
    const normalizedCode = normalizeRedeemCode(body?.code);
    const msgs = i18n.getMessagesbyContext(c);
    if (!normalizedCode) return c.text(msgs.RedeemCodeUnavailableMsg, 400);

    const row = await c.env.DB.prepare(
        `SELECT id, redeem_type, result
         FROM redeem_codes
         WHERE code = ? AND enabled = 1 AND redeemed = 1 AND result IS NOT NULL
         AND datetime(expires_at) > datetime('now')`
    ).bind(normalizedCode).first<RedeemResultRow>();
    if (!row) return c.text(msgs.RedeemCodeUnavailableMsg, 400);

    if (row.redeem_type === RedeemType.AddressPrefixOnce) {
        const result = await getRedeemedAddress(c, row);
        if (!result) return c.text(msgs.RedeemCodeUnavailableMsg, 400);
        return c.json({
            type: result.type,
            address: result.address,
            jwt: result.jwt,
            ...(typeof result.password === 'string' ? { password: result.password } : {}),
        });
    }
    const decrypted = await decryptRedeemResult(c, row.id, row.result);
    const result = getJsonObjectValue<RedeemResult>(decrypted);
    if (!result || result.type !== row.redeem_type) {
        return c.text(msgs.RedeemCodeUnavailableMsg, 400);
    }
    const response = getResultResponse(result);
    return response ? c.json(response) : c.text(msgs.RedeemCodeUnavailableMsg, 400);
};

export default { queryRedeemResult };
