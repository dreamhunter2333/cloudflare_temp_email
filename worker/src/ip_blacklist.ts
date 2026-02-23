import { Context } from 'hono';
import { getJsonSetting } from './utils';
import { CONSTANTS } from './constants';

/**
 * IP Blacklist Settings stored in database
 */
export type IpBlacklistSettings = {
    enabled?: boolean;
    blacklist?: string[];  // Array of regex patterns or plain strings
    asnBlacklist?: string[];  // Array of ASN organization patterns (e.g., "Google LLC", "Amazon")
    fingerprintBlacklist?: string[];  // Array of browser fingerprint patterns
    enableDailyLimit?: boolean;  // Enable daily request limit per IP
    dailyRequestLimit?: number;  // Maximum requests per IP per day
}

/**
 * Check if a string is a valid regex pattern
 * Heuristic: contains regex special characters
 */
function looksLikeRegex(pattern: string): boolean {
    // Check if pattern contains common regex metacharacters
    // eslint-disable-next-line no-useless-escape
    return /[\^$.*+?\[\]{}()|\\]/.test(pattern);
}

/**
 * Check if a value matches any blacklist pattern
 * Supports both regex patterns and plain string matching
 *
 * @param value - The value to check (e.g., IP address, ASN organization)
 * @param blacklist - Array of patterns (regex or plain strings)
 * @param caseSensitive - Whether to use case-sensitive matching for plain strings (default: true for IP, false for ASN)
 * @returns true if value is blacklisted, false otherwise
 *
 * @example
 * // IP address matching (case-sensitive):
 * isBlacklisted("192.168.1.100", ["192.168.1"], true) // true (substring match)
 * isBlacklisted("10.0.0.5", ["^10\\.0\\.0\\.5$"], true) // true (regex match)
 *
 * // ASN organization matching (case-insensitive):
 * isBlacklisted("Google LLC", ["google"], false) // true (case-insensitive)
 * isBlacklisted("Amazon.com, Inc.", ["amazon"], false) // true
 */
function isBlacklisted(value: string | null | undefined, blacklist: string[], caseSensitive: boolean = true): boolean {
    if (!value || !blacklist || blacklist.length === 0) {
        return false;
    }

    const normalizedValue = value.trim();

    return blacklist.some(pattern => {
        const normalizedPattern = pattern.trim();
        if (!normalizedPattern) {
            return false;
        }

        try {
            if (looksLikeRegex(normalizedPattern)) {
                // For regex patterns, add 'i' flag if case-insensitive matching is needed
                const flags = caseSensitive ? '' : 'i';
                const regex = new RegExp(normalizedPattern, flags);
                return regex.test(normalizedValue);
            }

            // Plain string mode: substring matching
            if (caseSensitive) {
                return normalizedValue.includes(normalizedPattern);
            }
            return normalizedValue.toLowerCase().includes(normalizedPattern.toLowerCase());
        } catch (error) {
            console.warn(`Pattern "${normalizedPattern}" failed regex parsing, using plain matching`);
            if (caseSensitive) {
                return normalizedValue.includes(normalizedPattern);
            }
            return normalizedValue.toLowerCase().includes(normalizedPattern.toLowerCase());
        }
    });
}

/**
 * Get IP blacklist settings from database
 *
 * @param c - Hono context
 * @returns IP blacklist settings (may be null or have undefined fields)
 */
export async function getIpBlacklistSettings(
    c: Context<HonoCustomType>
): Promise<IpBlacklistSettings | null> {
    return await getJsonSetting<IpBlacklistSettings>(
        c, CONSTANTS.IP_BLACKLIST_SETTINGS_KEY
    );
}

/**
 * Middleware to check access control (blacklist and rate limiting) for rate-limited endpoints
 * Returns 403/429 response if blocked, null if allowed or any error occurs
 *
 * @param c - Hono context
 * @returns Response if blocked, null otherwise (including errors)
 */
export async function checkAccessControl(
    c: Context<HonoCustomType>
): Promise<Response | null> {
    try {
        // Get IP blacklist settings from database
        const settings = await getIpBlacklistSettings(c);
        if (!settings) {
            return null;
        }

        // Get IP address from CloudFlare header
        const reqIp = c.req.raw.headers.get("cf-connecting-ip");
        if (!reqIp) {
            return null;
        }

        // Check if blacklist feature is enabled
        if (settings.enabled) {
            // Check if IP is blacklisted (case-sensitive matching)
            if (settings.blacklist && settings.blacklist.length > 0) {
                if (isBlacklisted(reqIp, settings.blacklist, true)) {
                    console.warn(`Blocked blacklisted IP: ${reqIp} for path: ${c.req.path}`);
                    return c.text(`Access denied: IP ${reqIp} is blacklisted`, 403);
                }
            }

            // Check ASN organization blacklist
            if (settings.asnBlacklist && settings.asnBlacklist.length > 0) {
                const asOrganization = c.req.raw.cf?.asOrganization;
                // Check ASN with case-insensitive matching
                if (asOrganization && isBlacklisted(asOrganization as string, settings.asnBlacklist, false)) {
                    console.warn(`Blocked blacklisted ASN: ${asOrganization} (IP: ${reqIp}) for path: ${c.req.path}`);
                    return c.text(`Access denied: ASN organization is blacklisted`, 403);
                }
            }

            // Check browser fingerprint blacklist
            if (settings.fingerprintBlacklist && settings.fingerprintBlacklist.length > 0) {
                const fingerprint = c.req.raw.headers.get("x-fingerprint");
                // Check fingerprint with case-sensitive matching
                if (fingerprint && isBlacklisted(fingerprint, settings.fingerprintBlacklist, true)) {
                    console.warn(`Blocked blacklisted fingerprint: ${fingerprint} (IP: ${reqIp}) for path: ${c.req.path}`);
                    return c.text(`Access denied: Browser fingerprint is blacklisted`, 403);
                }
            }
        }

        // Check daily request limit (independent of blacklist feature)
        if (settings.enableDailyLimit && settings.dailyRequestLimit && c.env.KV) {
            const daily_count_key = `limit|${reqIp}|${new Date().toISOString().slice(0, 10)}`;
            const dailyLimit = settings.dailyRequestLimit;
            const current_count = parseInt(await c.env.KV.get(daily_count_key) || "0", 10);

            if (current_count && current_count >= dailyLimit) {
                console.warn(`Blocked IP ${reqIp} exceeded daily limit of ${dailyLimit} requests for path: ${c.req.path}`);
                return c.text(`IP=${reqIp} Exceeded daily limit of ${dailyLimit} requests`, 429);
            }

            // Increment counter with 24-hour expiration
            await c.env.KV.put(daily_count_key, ((current_count || 0) + 1).toString(), { expirationTtl: 24 * 60 * 60 });
        }

        return null;
    } catch (error) {
        // Log error but don't block request
        console.error('Error checking IP blacklist and rate limit:', error);
        return null;
    }
}
