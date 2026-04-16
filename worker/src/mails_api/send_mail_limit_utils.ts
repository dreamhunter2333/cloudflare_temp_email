import { Context } from "hono";
import i18n from "../i18n";
import { SendMailLimitConfig } from "../models";
import { CONSTANTS } from "../constants";
import { getJsonObjectValue, getSetting } from "../utils";

const normalizeNullableLimit = (value: unknown): number | null => {
    if (value === null || typeof value === "undefined") {
        return null;
    }
    if (!Number.isInteger(value) || (value as number) < -1) {
        return null;
    }
    return value as number;
}

const isValidLimitValue = (value: number | null): boolean => {
    return value === -1 || (value !== null && value >= 0);
}

export const normalizeSendMailLimitConfig = (value: unknown): SendMailLimitConfig | null => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const config = value as Record<string, unknown>;
    if (typeof config.dailyEnabled !== "boolean" || typeof config.monthlyEnabled !== "boolean") {
        return null;
    }
    const dailyLimit = normalizeNullableLimit(config.dailyLimit);
    const monthlyLimit = normalizeNullableLimit(config.monthlyLimit);
    const monthlyValid = config.monthlyEnabled
        ? isValidLimitValue(monthlyLimit)
        : (config.monthlyLimit === null || typeof config.monthlyLimit === "undefined" || monthlyLimit !== null);
    const dailyValid = config.dailyEnabled
        ? isValidLimitValue(dailyLimit)
        : (config.dailyLimit === null || typeof config.dailyLimit === "undefined" || dailyLimit !== null);
    if (!dailyValid || !monthlyValid) {
        return null;
    }
    return {
        dailyEnabled: config.dailyEnabled,
        monthlyEnabled: config.monthlyEnabled,
        dailyLimit: config.dailyEnabled ? dailyLimit : null,
        monthlyLimit: config.monthlyEnabled ? monthlyLimit : null,
    };
}

export const getSendMailLimitConfig = async (
    c: Context<HonoCustomType>
): Promise<SendMailLimitConfig | null> => {
    const config = getJsonObjectValue<SendMailLimitConfig>(
        await getSetting(c, CONSTANTS.SEND_MAIL_LIMIT_CONFIG_KEY)
    );
    return normalizeSendMailLimitConfig(config);
}

const requireLimitKV = (
    c: Context<HonoCustomType>
): KVNamespace => {
    const kv = c.env.KV;
    if (!kv) {
        throw new Error(i18n.getMessagesbyContext(c).EnableKVMsg);
    }
    return kv;
}

const getDailyCountKey = (date: Date = new Date()): string => {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${CONSTANTS.SEND_MAIL_LIMIT_COUNT_KEY_PREFIX}daily:${yyyy}-${mm}-${dd}`;
}

const getMonthlyCountKey = (date: Date = new Date()): string => {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${CONSTANTS.SEND_MAIL_LIMIT_COUNT_KEY_PREFIX}monthly:${yyyy}-${mm}`;
}

const getCount = async (
    kv: KVNamespace,
    key: string
): Promise<number> => {
    const value = await kv.get(key);
    if (!value) {
        return 0;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return 0;
    }
    return parsed;
}

export const ensureSendMailLimit = async (
    c: Context<HonoCustomType>
): Promise<void> => {
    const msgs = i18n.getMessagesbyContext(c);
    const config = await getSendMailLimitConfig(c);
    if (!config || (!config.dailyEnabled && !config.monthlyEnabled)) {
        return;
    }
    const kv = requireLimitKV(c);
    if (config.dailyEnabled && config.dailyLimit !== null && config.dailyLimit !== -1) {
        const current = await getCount(kv, getDailyCountKey());
        if (current >= config.dailyLimit) {
            throw new Error(`${msgs.SendMailDailyLimitMsg} (${current}/${config.dailyLimit})`);
        }
    }
    if (config.monthlyEnabled && config.monthlyLimit !== null && config.monthlyLimit !== -1) {
        const current = await getCount(kv, getMonthlyCountKey());
        if (current >= config.monthlyLimit) {
            throw new Error(`${msgs.SendMailMonthlyLimitMsg} (${current}/${config.monthlyLimit})`);
        }
    }
}

const getNextUtcDayExpiration = (date: Date = new Date()): number => {
    return Math.floor(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
        0, 0, 0
    ) / 1000);
}

const getNextUtcMonthExpiration = (date: Date = new Date()): number => {
    return Math.floor(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        1,
        0, 0, 0
    ) / 1000);
}

const increaseCount = async (
    kv: KVNamespace,
    key: string,
    expiration: number
): Promise<void> => {
    const current = await getCount(kv, key);
    const now = Math.floor(Date.now() / 1000);
    const expirationTtl = Math.max(expiration - now, 60);
    await kv.put(key, String(current + 1), { expirationTtl });
}

export const increaseSendMailLimitCount = async (
    c: Context<HonoCustomType>
): Promise<void> => {
    const config = await getSendMailLimitConfig(c);
    if (!config || (!config.dailyEnabled && !config.monthlyEnabled)) {
        return;
    }
    const kv = requireLimitKV(c);
    try {
        if (config.dailyEnabled) {
            await increaseCount(kv, getDailyCountKey(), getNextUtcDayExpiration());
        }
        if (config.monthlyEnabled) {
            await increaseCount(kv, getMonthlyCountKey(), getNextUtcMonthExpiration());
        }
    } catch (e) {
        console.warn(`Failed to increment send_mail_limit_count`, e);
    }
}
