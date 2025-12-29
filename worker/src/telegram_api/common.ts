import { Context } from "hono";
import { Jwt } from "hono/utils/jwt";
import { CONSTANTS } from "../constants";
import { getBooleanValue, getIntValue, getJsonSetting } from "../utils";
import { deleteAddressWithData, newAddress, generateRandomName } from "../common";
import { LocaleMessages } from "../i18n/type";

export const tgUserNewAddress = async (
    c: Context<HonoCustomType>, userId: string, address: string,
    msgs: LocaleMessages
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
        sourceMeta: `tg:${userId}`
    });
    // for mail push to telegram
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify([...jwtList, res.jwt]));
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
            const { address, address_id } = await Jwt.verify(jwt, c.env.JWT_SECRET, "HS256");
            const name = await c.env.DB.prepare(
                `SELECT name FROM address WHERE id = ? `
            ).bind(address_id).first("name");
            if (!name) {
                addressList.push(msgs.TgInvalidAddressMsg);
                invalidJwtList.push(jwt);
                continue;
            }
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
    const { address } = await Jwt.verify(jwt, c.env.JWT_SECRET, "HS256");
    if (!address) {
        throw Error(msgs.TgInvalidCredentialMsg);
    }
    const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
    const { addressIdMap } = await jwtListToAddressData(c, jwtList, msgs);
    if (address as string in addressIdMap) {
        return address as string;
    }
    if (jwtList.length >= getIntValue(c.env.TG_MAX_ADDRESS, 5)) {
        throw Error(msgs.TgMaxAddressReachedCleanMsg);
    }
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify([...jwtList, jwt]));
    // for mail push to telegram
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${address}`, userId.toString());
    return address as string;
}

export const unbindTelegramAddress = async (
    c: Context<HonoCustomType>, userId: string, address: string
): Promise<boolean> => {
    const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
    const newJwtList = [];
    for (const jwt of jwtList) {
        try {
            const { address: kvAddress } = await Jwt.verify(jwt, c.env.JWT_SECRET, "HS256");
            if (kvAddress == address) {
                continue;
            }
        } catch (e) {
            console.log(`解绑失败: ${(e as Error).message}`);
        }
        newJwtList.push(jwt);
    }
    await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify(newJwtList));
    await c.env.KV.delete(`${CONSTANTS.TG_KV_PREFIX}:${address}`);
    return true;
}

export const unbindTelegramByAddress = async (
    c: Context<HonoCustomType>, address: string
): Promise<boolean> => {
    if (!c.env.KV) return true;
    const userId = await c.env.KV.get<string>(`${CONSTANTS.TG_KV_PREFIX}:${address}`)
    if (userId) {
        return await unbindTelegramAddress(c, userId, address);
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
