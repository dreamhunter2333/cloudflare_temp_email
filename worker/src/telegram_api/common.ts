import { Context } from "hono";
import { Jwt } from "hono/utils/jwt";
import { validateAddressIdentity, verifyAddressToken } from '../address_auth';
import { CONSTANTS } from "../constants";
import { getBooleanValue, getIntValue, getJsonSetting } from "../utils";
import { deleteAddressWithData, newAddress, generateRandomName } from "../common";
import { LocaleMessages } from "../i18n/type";
import i18n from '../i18n';

const createTelegramBindingToken = (c: Context<HonoCustomType>, address: string, addressId: number) =>
    Jwt.sign({ type: 'telegram_binding', address, address_id: addressId }, c.env.JWT_SECRET, 'HS256');

// Only for tokens read from the authenticated Telegram user's stored bindings.
export const verifyTelegramBindingToken = async (c: Context<HonoCustomType>, token: string) => {
    const payload = await Jwt.verify(token, c.env.JWT_SECRET, { alg: 'HS256', exp: false });
    if (payload.type !== undefined && payload.type !== 'telegram_binding'
        && payload.type !== 'address_password_login') {
        throw new Error(i18n.getMessagesbyContext(c).InvalidAddressCredentialMsg);
    }
    const identity = await validateAddressIdentity(c, payload);
    if (!identity) throw new Error(i18n.getMessagesbyContext(c).InvalidAddressCredentialMsg);
    return identity;
};

export const tgUserNewAddress = async (
    c: Context<HonoCustomType>, userId: string, address: string,
    msgs: LocaleMessages,
    enableRandomSubdomain: boolean = false
): Promise<{ address: string, jwt: string, password?: string | null }> => {
    if (c.env.RATE_LIMITER) {
        const { success } = await c.env.RATE_LIMITER.limit(
            { key: `${CONSTANTS.TG_KV_PREFIX}:${userId}` }
        )
        if (!success) {
            throw Error("Rate limit exceeded")
        }
    }
    // Check if custom address names are disabled
    const disableCustomAddressName = getBooleanValue(c.env.DISABLE_CUSTOM_ADDRESS_NAME);

    // Parse address parameter - handle empty or whitespace-only address
    const trimmedAddress = address ? address.trim() : "";
    const [name, domain] = trimmedAddress.includes("@") ? trimmedAddress.split("@") : [trimmedAddress, null];
    const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
    if (jwtList.length >= getIntValue(c.env.TG_MAX_ADDRESS, 5)) {
        throw Error(msgs.TgMaxAddressReachedMsg);
    }
    // Generate name if disabled or not provided
    const finalName = (!name || disableCustomAddressName) ? generateRandomName(c) : name;

    // check name block list
    const value = await getJsonSetting(c, CONSTANTS.ADDRESS_BLOCK_LIST_KEY);
    const blockList = (value || []) as string[];
    if (blockList.some((item) => finalName.includes(item))) {
        throw Error(`Name[${finalName}]is blocked`);
    }

    const res = await newAddress(c, {
        name: finalName,
        domain,
        enablePrefix: true,
        enableRandomSubdomain,
        sourceMeta: `tg:${userId}`
    });
    // for mail push to telegram
    const bindingToken = await createTelegramBindingToken(c, res.address, res.address_id);
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify([...jwtList, bindingToken]));
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${res.address}`, userId.toString());
    return res;
}

export const jwtListToAddressData = async (
    c: Context<HonoCustomType>, jwtList: string[],
    msgs: LocaleMessages
): Promise<{
    addressList: string[], addressIdMap: Record<string, number>,
    invalidJwtList: string[]
}> => {
    const addressList = [] as string[];
    const addressIdMap = {} as Record<string, number>;
    const invalidJwtList = [] as string[];
    for (const jwt of jwtList) {
        try {
            const { address, address_id } = await verifyTelegramBindingToken(c, jwt);
            addressList.push(address as string);
            addressIdMap[address as string] = address_id as number;
        } catch (e) {
            addressList.push(msgs.TgInvalidCredentialMsg);
            invalidJwtList.push(jwt);
            console.log(`Failed to get address list: ${(e as Error).message}`);
        }
    }
    return { addressList, addressIdMap, invalidJwtList };
}

export const bindTelegramAddress = async (
    c: Context<HonoCustomType>, userId: string, jwt: string,
    msgs: LocaleMessages
): Promise<string> => {
    const { address, address_id } = await verifyAddressToken(c, jwt);
    const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
    const { addressIdMap } = await jwtListToAddressData(c, jwtList, msgs);
    if (address as string in addressIdMap) {
        await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${address}`, userId.toString());
        return address as string;
    }
    if (jwtList.length >= getIntValue(c.env.TG_MAX_ADDRESS, 5)) {
        throw Error(msgs.TgMaxAddressReachedCleanMsg);
    }
    const bindingToken = await createTelegramBindingToken(c, address, address_id);
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify([...jwtList, bindingToken]));
    // for mail push to telegram
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${address}`, userId.toString());
    return address as string;
}

const getTelegramBindings = async (c: Context<HonoCustomType>, userId: string) => {
    const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
    return Promise.all(jwtList.map(async (jwt) => {
        try {
            return { jwt, payload: await Jwt.verify(jwt, c.env.JWT_SECRET, { alg: 'HS256', exp: false }) };
        } catch (e) {
            console.log(`解绑失败: ${(e as Error).message}`);
            return { jwt, payload: null };
        }
    }));
}

const removeTelegramBinding = async (
    c: Context<HonoCustomType>, userId: string, address: string,
    bindings: Awaited<ReturnType<typeof getTelegramBindings>>
): Promise<boolean> => {
    const newJwtList = bindings.filter(({ payload }) => payload?.address !== address).map(({ jwt }) => jwt);
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify(newJwtList));
    const owner = await c.env.KV.get<string>(`${CONSTANTS.TG_KV_PREFIX}:${address}`);
    if (owner === userId) await c.env.KV.delete(`${CONSTANTS.TG_KV_PREFIX}:${address}`);
    return true;
}

export const unbindTelegramAddress = async (
    c: Context<HonoCustomType>, userId: string, address: string
): Promise<boolean> => {
    const msgs = i18n.getMessagesbyContext(c);
    const bindings = await getTelegramBindings(c, userId);
    for (const { jwt, payload } of bindings) {
        if (payload?.address !== address) continue;
        try {
            await verifyTelegramBindingToken(c, jwt);
        } catch (e) {
            console.log(`Failed to validate Telegram binding: ${(e as Error).message}`);
            continue;
        }
        return await removeTelegramBinding(c, userId, address, bindings);
    }
    throw Error(msgs.TgAddressNotYoursMsg);
}

export const unbindTelegramByAddress = async (
    c: Context<HonoCustomType>, address: string
): Promise<boolean> => {
    if (!c.env.KV) return true;
    const userId = await c.env.KV.get<string>(`${CONSTANTS.TG_KV_PREFIX}:${address}`)
    if (userId) {
        const bindings = await getTelegramBindings(c, userId);
        return await removeTelegramBinding(c, userId, address, bindings);
    }
    return true;
}


export const deleteTelegramAddress = async (
    c: Context<HonoCustomType>, userId: string, address: string,
    msgs: LocaleMessages
): Promise<boolean> => {
    const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
    const { addressIdMap } = await jwtListToAddressData(c, jwtList, msgs);
    if (!(address in addressIdMap)) {
        throw Error(msgs.TgAddressNotYoursMsg);
    }
    await deleteAddressWithData(c, null, addressIdMap[address])
    return true;
}
