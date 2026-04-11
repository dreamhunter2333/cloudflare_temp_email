import { Context } from "hono";
import { CONSTANTS } from "../constants";
import { getJsonSetting, saveSetting } from "../utils";
import { IpBlacklistSettings } from "../ip_blacklist";
import i18n from "../i18n";

/**
 * Get IP blacklist settings from database
 */
async function getIpBlacklistSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await getJsonSetting<IpBlacklistSettings>(
        c, CONSTANTS.IP_BLACKLIST_SETTINGS_KEY
    );

    // Return default settings if not found
    return c.json(settings || {
        enabled: false,
        blacklist: [],
        asnBlacklist: [],
        fingerprintBlacklist: [],
        enableWhitelist: false,
        whitelist: [],
        enableDailyLimit: false,
        dailyRequestLimit: 1000
    });
}

/**
 * Save IP blacklist settings to database
 */
async function saveIpBlacklistSettings(c: Context<HonoCustomType>): Promise<Response> {
    const msgs = i18n.getMessagesbyContext(c);
    const settings = await c.req.json<IpBlacklistSettings>();

    // Backward compatibility: default new fields if absent (older frontends)
    settings.enableWhitelist = settings.enableWhitelist ?? false;
    settings.whitelist = settings.whitelist ?? [];

    // Validate settings
    if (typeof settings.enabled !== 'boolean') {
        return c.text(`${msgs.InvalidIpBlacklistSettingMsg}: enabled`, 400);
    }

    if (!Array.isArray(settings.blacklist)) {
        return c.text(`${msgs.InvalidIpBlacklistSettingMsg}: blacklist`, 400);
    }

    if (!Array.isArray(settings.asnBlacklist)) {
        return c.text(`${msgs.InvalidIpBlacklistSettingMsg}: asnBlacklist`, 400);
    }

    if (!Array.isArray(settings.fingerprintBlacklist)) {
        return c.text(`${msgs.InvalidIpBlacklistSettingMsg}: fingerprintBlacklist`, 400);
    }

    if (typeof settings.enableWhitelist !== 'boolean') {
        return c.text(`${msgs.InvalidIpBlacklistSettingMsg}: enableWhitelist`, 400);
    }

    if (!Array.isArray(settings.whitelist)) {
        return c.text(`${msgs.InvalidIpBlacklistSettingMsg}: whitelist`, 400);
    }

    if (typeof settings.enableDailyLimit !== 'boolean') {
        return c.text(`${msgs.InvalidIpBlacklistSettingMsg}: enableDailyLimit`, 400);
    }

    const limit = Number(settings.dailyRequestLimit);
    if (isNaN(limit) || limit < 1 || limit > 1000000) {
        return c.text(`${msgs.InvalidIpBlacklistSettingMsg}: dailyRequestLimit (1-1000000)`, 400);
    }

    // Add size limit
    const MAX_BLACKLIST_SIZE = 1000;
    if (settings.blacklist.length > MAX_BLACKLIST_SIZE) {
        return c.text(`${msgs.BlacklistExceedsMaxSizeMsg}: blacklist (${MAX_BLACKLIST_SIZE})`, 400);
    }

    if (settings.asnBlacklist.length > MAX_BLACKLIST_SIZE) {
        return c.text(`${msgs.BlacklistExceedsMaxSizeMsg}: asnBlacklist (${MAX_BLACKLIST_SIZE})`, 400);
    }

    if (settings.fingerprintBlacklist.length > MAX_BLACKLIST_SIZE) {
        return c.text(`${msgs.BlacklistExceedsMaxSizeMsg}: fingerprintBlacklist (${MAX_BLACKLIST_SIZE})`, 400);
    }

    if (settings.whitelist.length > MAX_BLACKLIST_SIZE) {
        return c.text(`${msgs.BlacklistExceedsMaxSizeMsg}: whitelist (${settings.whitelist.length}/${MAX_BLACKLIST_SIZE})`, 400);
    }

    // Sanitize patterns (trim and remove empty strings)
    // Both regex and plain strings are allowed
    const sanitizedBlacklist = settings.blacklist
        .map(pattern => pattern.trim())
        .filter(pattern => pattern.length > 0);

    const sanitizedAsnBlacklist = settings.asnBlacklist
        .map(pattern => pattern.trim())
        .filter(pattern => pattern.length > 0);

    const sanitizedFingerprintBlacklist = settings.fingerprintBlacklist
        .map(pattern => pattern.trim())
        .filter(pattern => pattern.length > 0);

    const sanitizedWhitelist = settings.whitelist
        .map(pattern => pattern.trim())
        .filter(pattern => pattern.length > 0);

    const sanitizedSettings: IpBlacklistSettings = {
        enabled: settings.enabled,
        blacklist: sanitizedBlacklist,
        asnBlacklist: sanitizedAsnBlacklist,
        fingerprintBlacklist: sanitizedFingerprintBlacklist,
        enableWhitelist: settings.enableWhitelist,
        whitelist: sanitizedWhitelist,
        enableDailyLimit: settings.enableDailyLimit,
        dailyRequestLimit: settings.dailyRequestLimit
    };

    await saveSetting(
        c,
        CONSTANTS.IP_BLACKLIST_SETTINGS_KEY,
        JSON.stringify(sanitizedSettings)
    );

    return c.json({ success: true });
}

export default {
    getIpBlacklistSettings,
    saveIpBlacklistSettings,
}
