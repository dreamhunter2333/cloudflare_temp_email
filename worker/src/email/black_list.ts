import { addressParser } from "postal-mime";

import { CONSTANTS } from "../constants";

const parseSenderAddresses = (headers: Headers): string[] => {
    try {
        const fromHeader = headers.get("From") || "";
        const senderAddresses = addressParser(fromHeader, { flatten: true })
            .map(sender => sender.address || "")
            .filter(Boolean);
        console.log("Email From header parsed", { fromHeader, senderAddresses });
        return senderAddresses;
    } catch (error) {
        console.error("Failed to parse sender addresses", error);
        return [];
    }
};

export const isBlocked = async (message: Pick<ForwardableEmailMessage, "from" | "headers">, env: Bindings): Promise<boolean> => {
    console.log("Email envelope sender", { from: message.from });
    const senders = [message.from, ...parseSenderAddresses(message.headers)];
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
