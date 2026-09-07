import { Context, Next } from 'hono';
import { jwt } from 'hono/jwt';
import { Jwt } from 'hono/utils/jwt';

import i18n from './i18n';

export const validateAddressPayload = async (
    c: Context<HonoCustomType>,
    payload: Record<string, unknown>,
): Promise<JwtPayload | null> => {
    const { address, address_id } = payload;
    if (typeof address !== 'string' || !address) return null;
    if (typeof address_id !== 'number'
        && (typeof address_id !== 'string' || !/^\d+$/.test(address_id))
    ) return null;
    const addressId = Number(address_id);
    if (!Number.isSafeInteger(addressId) || addressId <= 0) return null;
    const exists = await c.env.DB.prepare(
        `SELECT id FROM address WHERE id = ? AND name = ?`
    ).bind(addressId, address).first<number>('id');
    return exists ? { address, address_id: addressId } : null;
};

export const verifyAddressToken = async (
    c: Context<HonoCustomType>,
    token: string,
): Promise<JwtPayload> => {
    const payload = await Jwt.verify(token, c.env.JWT_SECRET, 'HS256');
    const addressPayload = await validateAddressPayload(c, payload);
    if (!addressPayload) {
        throw new Error(i18n.getMessagesbyContext(c).InvalidAddressCredentialMsg);
    }
    return addressPayload;
};

export const addressJwtAuth = async (c: Context<HonoCustomType>, next: Next) => (
    jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' })(c, async () => {
        const payload = await validateAddressPayload(c, c.get('jwtPayload'));
        if (!payload) {
            c.res = c.text(i18n.getMessagesbyContext(c).InvalidAddressCredentialMsg, 401);
            return;
        }
        c.set('jwtPayload', payload);
        await next();
    })
);
