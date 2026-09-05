import { Context } from 'hono';

import i18n from '../i18n';
import { isRedeemType, normalizeRedeemCode } from './redeem_code';

type QueryRedeemCodeRow = {
    redeem_type: string,
    value: string,
    redeemed: 0 | 1,
    expires_at: string,
};

const queryRedeemCode = async (c: Context<HonoCustomType>) => {
    const body = await c.req.json<{ code?: unknown }>().catch(() => null);
    const normalizedCode = normalizeRedeemCode(body?.code);
    const msgs = i18n.getMessagesbyContext(c);
    if (!normalizedCode) return c.text(msgs.RedeemCodeUnavailableMsg, 400);

    const row = await c.env.DB.prepare(
        `SELECT redeem_type, value, redeemed, expires_at
         FROM redeem_codes
         WHERE code = ? AND enabled = 1`
    ).bind(normalizedCode).first<QueryRedeemCodeRow>();
    if (!row || !isRedeemType(row.redeem_type)) {
        return c.text(msgs.RedeemCodeUnavailableMsg, 400);
    }
    const expiresAt = Date.parse(row.expires_at);
    const status = !Number.isFinite(expiresAt) || expiresAt <= Date.now()
        ? 'expired'
        : row.redeemed === 1 ? 'redeemed' : 'unused';
    return c.json({
        redeem_type: row.redeem_type,
        value: row.value,
        status,
    });
};

export default { queryRedeemCode };
