import { Context } from 'hono';
import { getJsonSetting } from './utils';
import { CONSTANTS } from './constants';

/**
 * IP Blacklist Settings stored in database
 */
export type IpBlacklistSettings = {
    enabled: boolean;
    blacklist: string[];  // Array of regex patterns or plain strings
    asnBlacklist?: string[];  // Array of ASN organization patterns (e.g., "Google LLC", "Amazon")
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
                const regex = new RegExp(normalizedPattern);
                return regex.test(normalizedValue);
            } else {
                // Plain string mode: substring matching
                if (caseSensitive) {
                    return normalizedValue.includes(normalizedPattern);
                } else {
                    return normalizedValue.toLowerCase().includes(normalizedPattern.toLowerCase());
                }
            }
        } catch (error) {
            console.warn(`Pattern "${normalizedPattern}" failed regex parsing, using plain matching`);
            if (caseSensitive) {
                return normalizedValue.includes(normalizedPattern);
            } else {
                return normalizedValue.toLowerCase().includes(normalizedPattern.toLowerCase());
            }
        }
    });
}

/**
 * Get IP blacklist settings from database
 *
 * @param c - Hono context
 * @returns IP blacklist settings
 */
export async function getIpBlacklistSettings(
    c: Context<HonoCustomType>
): Promise<IpBlacklistSettings> {
    const dbSettings = await getJsonSetting<IpBlacklistSettings>(
        c, CONSTANTS.IP_BLACKLIST_SETTINGS_KEY
    );

    if (dbSettings) {
        return {
            enabled: dbSettings.enabled || false,
            blacklist: dbSettings.blacklist || []
        };
    }

    // Return default settings
    return {
        enabled: false,
        blacklist: []
    };
}

/**
 * Middleware to check IP blacklist for rate-limited endpoints
 * Returns 403 response if IP is blacklisted, null if any error occurs
 *
 * @param c - Hono context
 * @returns Response if blacklisted, null otherwise (including errors)
 */
export async function checkIpBlacklist(
    c: Context<HonoCustomType>
): Promise<Response | null> {
    try {
        // Get IP blacklist settings from database
        const settings = await getIpBlacklistSettings(c);

        // Check if blacklist feature is enabled
        if (!settings.enabled) {
            return null;
        }

        // Get IP address from CloudFlare header
        const reqIp = c.req.raw.headers.get("cf-connecting-ip");
        if (!reqIp) {
            return null;
        }

        // Get blacklist
        if (!settings.blacklist || settings.blacklist.length === 0) {
            return null;
        }

        // Check if IP is blacklisted (case-sensitive matching)
        if (isBlacklisted(reqIp, settings.blacklist, true)) {
            console.warn(`Blocked blacklisted IP: ${reqIp} for path: ${c.req.path}`);
            return c.text(`Access denied: IP ${reqIp} is blacklisted`, 403);
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

        return null;
    } catch (error) {
        // Log error but don't block request
        console.error('Error checking IP blacklist:', error);
        return null;
    }
}
