import { Context } from "hono";
import { CONSTANTS } from "../constants";
import { getJsonSetting, saveSetting } from "../utils";
import { IpBlacklistSettings } from "../ip_blacklist";

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
        enableDailyLimit: false,
        dailyRequestLimit: 1000
    });
}

/**
 * Save IP blacklist settings to database
 */
async function saveIpBlacklistSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<IpBlacklistSettings>();

    // Validate settings
    if (typeof settings.enabled !== 'boolean') {
        return c.text("Invalid enabled value", 400);
    }

    if (!Array.isArray(settings.blacklist)) {
        return c.text("Invalid blacklist value", 400);
    }

    if (!Array.isArray(settings.asnBlacklist)) {
        return c.text("Invalid asnBlacklist value", 400);
    }

    if (!Array.isArray(settings.fingerprintBlacklist)) {
        return c.text("Invalid fingerprintBlacklist value", 400);
    }

    if (typeof settings.enableDailyLimit !== 'boolean') {
        return c.text("Invalid enableDailyLimit value", 400);
    }

    const limit = Number(settings.dailyRequestLimit);
    if (isNaN(limit) || limit < 1 || limit > 1000000) {
        return c.text("Invalid dailyRequestLimit value (must be between 1 and 1000000)", 400);
    }

    // Add size limit
    const MAX_BLACKLIST_SIZE = 1000;
    if (settings.blacklist.length > MAX_BLACKLIST_SIZE) {
        return c.text(
            `Blacklist exceeds maximum size (${MAX_BLACKLIST_SIZE} entries)`,
            400
        );
    }

    if (settings.asnBlacklist.length > MAX_BLACKLIST_SIZE) {
        return c.text(
            `ASN blacklist exceeds maximum size (${MAX_BLACKLIST_SIZE} entries)`,
            400
        );
    }

    if (settings.fingerprintBlacklist.length > MAX_BLACKLIST_SIZE) {
        return c.text(
            `Fingerprint blacklist exceeds maximum size (${MAX_BLACKLIST_SIZE} entries)`,
            400
        );
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

    const sanitizedSettings: IpBlacklistSettings = {
        enabled: settings.enabled,
        blacklist: sanitizedBlacklist,
        asnBlacklist: sanitizedAsnBlacklist,
        fingerprintBlacklist: sanitizedFingerprintBlacklist,
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
