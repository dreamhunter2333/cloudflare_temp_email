import { Context } from 'hono';
import { getJsonSetting } from './utils';
import { CONSTANTS } from './constants';

/**
 * IP Blacklist Settings stored in database
 */
export type IpBlacklistSettings = {
    enabled: boolean;
    blacklist: string[];  // Array of regex patterns or plain strings
}

/**
 * Check if a string is a valid regex pattern
 * Heuristic: contains regex special characters
 */
function looksLikeRegex(pattern: string): boolean {
    // Check if pattern contains common regex metacharacters
    return /[\^$.*+?\[\]{}()|\\]/.test(pattern);
}

/**
 * Check if an IP address matches any blacklist pattern
 * Supports both regex patterns and plain string matching
 *
 * @param ip - The IP address to check (e.g., "192.168.1.100")
 * @param blacklist - Array of patterns (regex or plain strings)
 * @returns true if IP is blacklisted, false otherwise
 *
 * @example
 * // Regex mode (has special chars: ^ $ . * + ? [ ] { } ( ) | \):
 * isIpBlacklisted("192.168.1.100", ["^192\\.168\\.1\\."]) // true (regex match)
 * isIpBlacklisted("10.0.0.5", ["^10\\.0\\.0\\.5$"]) // true (exact match)
 * isIpBlacklisted("192.168.10.1", ["^192\\.168\\.1\\."]) // false (no match)
 *
 * // Plain string mode (no special chars - substring matching):
 * // Rule: IP contains the pattern string
 * isIpBlacklisted("192.168.1.100", ["192.168.1"]) // true (IP包含"192.168.1")
 * isIpBlacklisted("192.168.1.255", ["192.168.1"]) // true (IP包含"192.168.1")
 * isIpBlacklisted("10.0.0.5", ["10.0.0"]) // true (IP包含"10.0.0")
 * isIpBlacklisted("192.168.2.100", ["192.168.1"]) // false (IP不包含"192.168.1")
 * isIpBlacklisted("192.168.10.1", ["192.168.1"]) // true (IP包含"192.168.1")
 */
export function isIpBlacklisted(ip: string | null, blacklist: string[]): boolean {
    if (!ip || !blacklist || blacklist.length === 0) {
        return false;
    }

    // Normalize IP (trim whitespace)
    const normalizedIp = ip.trim();

    // Check if IP matches any pattern in blacklist
    return blacklist.some(pattern => {
        const normalizedPattern = pattern.trim();
        if (!normalizedPattern) {
            return false;
        }

        try {
            // Try to detect if this is a regex pattern
            if (looksLikeRegex(normalizedPattern)) {
                // Regex mode: test as regular expression
                const regex = new RegExp(normalizedPattern);
                return regex.test(normalizedIp);
            } else {
                // Plain string mode: substring matching
                // 匹配规则：IP中包含设置的字符串就算匹配
                // Example: "192.168.1.100".includes("192.168.1") → true
                return normalizedIp.includes(normalizedPattern);
            }
        } catch (error) {
            // If regex parsing fails, fall back to plain string matching
            console.warn(`Pattern "${normalizedPattern}" failed regex parsing, using plain matching`);
            return normalizedIp.includes(normalizedPattern);
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

        // Check if IP is blacklisted
        if (isIpBlacklisted(reqIp, settings.blacklist)) {
            console.warn(`Blocked blacklisted IP: ${reqIp} for path: ${c.req.path}`);
            return c.text(`Access denied: IP ${reqIp} is blacklisted`, 403);
        }

        return null;
    } catch (error) {
        // Log error but don't block request
        console.error('Error checking IP blacklist:', error);
        return null;
    }
}
