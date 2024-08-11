import { CONSTANTS } from "../constants";
import { Bindings } from "../types";

export const isBlocked = async (from: string, env: Bindings): Promise<boolean> => {
    if (env.BLACK_LIST && env.BLACK_LIST.split(",").some(word => from.includes(word))) {
        return true;
    }
    if (!env.KV) {
        return false;
    }
    const blockList = await env.KV.get<string[]>(CONSTANTS.EMAIL_KV_BLACK_LIST, 'json') || [];
    if (blockList.some(word => from.includes(word))) {
        return true;
    }
    return false;
}
