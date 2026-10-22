import { Context, Next } from 'hono';
import { jwt } from 'hono/jwt';
import { Jwt } from 'hono/utils/jwt';

import i18n from './i18n';
import { isAddressPasswordLoginOnly } from './utils';

const ADDRESS_PASSWORD_LOGIN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const ADDRESS_PASSWORD_LOGIN_RENEWAL_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export const createAddressPasswordLoginToken = (
    c: Context<HonoCustomType>, address: string, addressId: number,
) => {
    const now = Math.floor(Date.now() / 1000);
    const payload: AddressPasswordLoginPayload = {
        address, address_id: addressId, type: 'address_password_login',
        iat: now, exp: now + ADDRESS_PASSWORD_LOGIN_TTL_SECONDS,
    };
    return Jwt.sign(payload, c.env.JWT_SECRET, 'HS256');
};

export const createAddressToken = (
    c: Context<HonoCustomType>, address: string, addressId: number,
) => {
    if (isAddressPasswordLoginOnly(c)) return createAddressPasswordLoginToken(c, address, addressId);
    const payload: AddressCredentialPayload = { address, address_id: addressId };
    return Jwt.sign(payload, c.env.JWT_SECRET, 'HS256');
};

export const validateAddressIdentity = async (
    c: Context<HonoCustomType>,
    payload: Record<string, unknown>,
): Promise<AddressCredentialPayload | null> => {
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

export const validateAddressPayload = async (
    c: Context<HonoCustomType>,
    payload: Record<string, unknown>,
): Promise<JwtPayload | null> => {
    if (payload.type !== undefined && payload.type !== 'address_password_login') return null;
    if (isAddressPasswordLoginOnly(c) && payload.type !== 'address_password_login') return null;
    const identity = await validateAddressIdentity(c, payload);
    if (!identity) return null;
    if (payload.type !== 'address_password_login') return identity;
    const { iat, exp } = payload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof iat !== 'number' || !Number.isSafeInteger(iat) || iat > now
        || typeof exp !== 'number' || !Number.isSafeInteger(exp) || exp <= now
        || exp <= iat || exp - iat > ADDRESS_PASSWORD_LOGIN_TTL_SECONDS
    ) return null;
    return { ...identity, type: 'address_password_login', iat, exp };
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
