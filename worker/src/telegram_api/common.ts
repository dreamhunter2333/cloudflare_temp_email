import { Context } from "hono";
import { Jwt } from "hono/utils/jwt";
import { CONSTANTS } from "../constants";
import { HonoCustomType } from "../types";

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
    const userId = await c.env.KV.get<string>(`${CONSTANTS.TG_KV_PREFIX}:${address}`)
    if (userId) {
        return await unbindTelegramAddress(c, userId, address);
    }
    return true;
}
