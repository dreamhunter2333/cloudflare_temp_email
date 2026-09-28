import { addressParser } from "postal-mime";

import { CONSTANTS } from "../constants";

export const isBlocked = async (message: Pick<ForwardableEmailMessage, "from" | "headers">, env: Bindings): Promise<boolean> => {
    const senderAddresses = addressParser(message.headers.get("From") || "", { flatten: true })
        .map(sender => sender.address || "")
        .filter(Boolean);
    const senders = [message.from, ...senderAddresses];
    if (env.BLACK_LIST && env.BLACK_LIST.split(",").some(word => senders.some(sender => sender.includes(word)))) {
        return true;
    }
    if (!env.KV) {
        return false;
    }
    const blockList = await env.KV.get<string[]>(CONSTANTS.EMAIL_KV_BLACK_LIST, 'json') || [];
    if (blockList.some(word => senders.some(sender => sender.includes(word)))) {
        return true;
    }
    return false;
}
