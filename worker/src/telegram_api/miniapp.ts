import { Context } from "hono";
import { Jwt } from 'hono/utils/jwt'
import { Bindings } from "../types";
import { CONSTANTS } from "../constants";

const encoder = new TextEncoder();


async function getTelegramBindAddress(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    // check if the request is from telegram
    const { initData } = await c.req.json();
    const initDataObj = new URLSearchParams(initData);
    initDataObj.sort()
    const hash = initDataObj.get('hash');
    initDataObj.delete("hash");
    const dataToCheck = [...initDataObj.entries()].map(([key, value]) => key + "=" + value).join("\n");
    const auth_date = Number(initDataObj.get('auth_date'));
    // valid for 300 seconds
    if (auth_date + 300 < (new Date().getTime() / 1000)) {
        return c.text("OutDate initData", 400);
    }
    const user = initDataObj.get('user');
    if (!hash || !user) {
        return c.text("Invalid initData", 400);
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
        return c.text("Invalid initData", 400);
    }
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

export default {
    getTelegramBindAddress
}
