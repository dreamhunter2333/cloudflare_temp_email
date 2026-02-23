import { Context } from "hono";
import { Jwt } from 'hono/utils/jwt'
import { CONSTANTS } from "../constants";
import { bindTelegramAddress, jwtListToAddressData, tgUserNewAddress, unbindTelegramAddress } from "./common";
import { checkCfTurnstile } from "../utils";
import { TelegramSettings } from "./settings";
import i18n from "../i18n";

const encoder = new TextEncoder();
const TG_AUTH_TIMEOUT = 300;

const checkTelegramAuth = async (
    c: Context<HonoCustomType>, initData: string
): Promise<string> => {
    // check if the request is from telegram
    const initDataObj = new URLSearchParams(initData);
    initDataObj.sort()
    const hash = initDataObj.get('hash');
    initDataObj.delete("hash");
    const dataToCheck = [...initDataObj.entries()].map(([key, value]) => key + "=" + value).join("\n");
    const auth_date = Number(initDataObj.get('auth_date'));
    if (auth_date + TG_AUTH_TIMEOUT < (new Date().getTime() / 1000)) {
        throw Error("Auth date expired");
    }
    const user = initDataObj.get('user');
    if (!hash || !user) {
        throw Error("Invalid initData");
    }
    const { id: userId } = JSON.parse(user);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode("WebAppData"),
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    const secretKeyBuffer = await crypto.subtle.sign(
        "HMAC", cryptoKey, encoder.encode(c.env.TELEGRAM_BOT_TOKEN)
    );
    const secretKey = await crypto.subtle.importKey(
        "raw",
        secretKeyBuffer,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign", "verify"]
    );
    const calcHmac = await crypto.subtle.sign(
        "HMAC", secretKey, encoder.encode(dataToCheck)
    );
    const calcHash = Array.from(new Uint8Array(calcHmac))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    if (calcHash != hash) {
        throw Error("Invalid initData");
    }
    if (typeof userId === "number") {
        return userId.toString();
    }
    return userId;
}

async function getTelegramBindAddress(c: Context<HonoCustomType>): Promise<Response> {
    const { initData } = await c.req.json();
    try {
        const userId = await checkTelegramAuth(c, initData);
        // get the address list from the KV
        const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
        const res = [];
        for (const jwt of jwtList) {
            try {
                const { address } = await Jwt.verify(jwt, c.env.JWT_SECRET, "HS256");
                res.push({ address, jwt });
            } catch (e) {
                console.error(`failed to verify jwt with error: ${e}`)
                continue;
            }
        }
        return c.json(res);
    }
    catch (e) {
        return c.text((e as Error).message, 400);
    }
}

async function newTelegramAddress(c: Context<HonoCustomType>): Promise<Response> {
    const { initData, address, cf_token } = await c.req.json();
    const msgs = i18n.getMessagesbyContext(c);
    // check cf turnstile
    try {
        await checkCfTurnstile(c, cf_token);
    } catch (error) {
        return c.text(msgs.TurnstileCheckFailedMsg, 500)
    }
    try {
        const userId = await checkTelegramAuth(c, initData);
        // get the address list from the KV
        const res = await tgUserNewAddress(c, userId, address, msgs)
        return c.json(res);
    }
    catch (e) {
        return c.text((e as Error).message, 400);
    }
}

async function bindAddress(c: Context<HonoCustomType>): Promise<Response> {
    const { initData, jwt } = await c.req.json();
    const msgs = i18n.getMessagesbyContext(c);
    try {
        const userId = await checkTelegramAuth(c, initData);
        await bindTelegramAddress(c, userId, jwt, msgs);
        return c.json({ success: true });
    }
    catch (e) {
        return c.text((e as Error).message, 400);
    }
}

async function unbindAddress(c: Context<HonoCustomType>): Promise<Response> {
    const { initData, address } = await c.req.json();
    try {
        const userId = await checkTelegramAuth(c, initData);
        await unbindTelegramAddress(c, userId, address);
        return c.json({ success: true });
    }
    catch (e) {
        return c.text((e as Error).message, 400);
    }
}

async function getMail(c: Context<HonoCustomType>): Promise<Response> {
    const { initData, mailId } = await c.req.json();
    const msgs = i18n.getMessagesbyContext(c);
    try {
        const userId = await checkTelegramAuth(c, initData);
        const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
        const { addressList, addressIdMap } = await jwtListToAddressData(c, jwtList, msgs);
        const result = await c.env.DB.prepare(
            `SELECT * FROM raw_mails where id = ?`
        ).bind(mailId).first();
        const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
        const superUser = settings?.enableGlobalMailPush && settings?.globalMailPushList.includes(userId);
        if (!superUser) {
            if (result?.address && !(result.address as string in addressIdMap)) {
                return c.text(msgs.TgNoPermissionViewMailMsg, 403);
            }
            const address_id = addressIdMap[result?.address as string];
            const db_address_id = await c.env.DB.prepare(
                `SELECT id FROM address where id = ? `
            ).bind(address_id).first("id");
            if (!db_address_id) {
                return c.text(msgs.TgNoPermissionViewMailMsg, 403);
            }
        }
        return c.json(result);
    }
    catch (e) {
        return c.text((e as Error).message, 400);
    }
}

export default {
    getTelegramBindAddress,
    newTelegramAddress,
    bindAddress,
    unbindAddress,
    getMail,
}
