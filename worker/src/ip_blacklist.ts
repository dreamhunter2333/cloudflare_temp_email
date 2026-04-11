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
    enableWhitelist?: boolean;  // Enable IP whitelist (strict allowlist mode)
    whitelist?: string[];  // Array of exact IPs or anchored regex; only matching IPs are allowed
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
 * Whitelist-style match: strict allowlist, independent from blacklist semantics.
 * Plain IPv4/IPv6 entries are matched EXACTLY (not as regex) to avoid unintended matches.
 * Only explicit regex patterns (containing metacharacters beyond dots/colons) are treated as regex.
 *
 * Examples:
 *   "1.2.3.4"              → exact match only (NOT treated as regex /1.2.3.4/)
 *   "2001:db8::1"          → exact match only
 *   "^192\\.168\\.1\\.\\d+$" → regex (contains anchors/escapes)
 */
function isWhitelisted(value: string | null | undefined, whitelist: string[] | undefined): boolean {
    if (!value || !whitelist || whitelist.length === 0) {
        return false;
    }

    const normalizedValue = value.trim();

    return whitelist.some(pattern => {
        const normalizedPattern = pattern.trim();
        if (!normalizedPattern) {
            return false;
        }

        // IPv4 detection: digits and dots only → exact match (bypass regex heuristic)
        if (/^\d+\.\d+\.\d+\.\d+$/.test(normalizedPattern)) {
            return normalizedValue === normalizedPattern;
        }

        // IPv4-mapped IPv6: ::ffff:1.2.3.4 → exact match
        if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(normalizedPattern)) {
            return normalizedValue === normalizedPattern;
        }

        // IPv6 detection: hex digits and colons → exact match
        if (/^[0-9a-fA-F:]+$/.test(normalizedPattern) && normalizedPattern.includes(':')) {
            return normalizedValue === normalizedPattern;
        }

        // Regex detection: contains metacharacters beyond dots/colons
        if (looksLikeRegex(normalizedPattern)) {
            try {
                const regex = new RegExp(normalizedPattern);
                return regex.test(normalizedValue);
            } catch (error) {
                // Invalid regex in a whitelist = never match (fail closed)
                console.warn(`Whitelist regex "${normalizedPattern}" failed to parse: ${(error as Error).message}, treating as no-match`);
                return false;
            }
        }

        // Fallback: other plain strings → exact match
        return normalizedValue === normalizedPattern;
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
 * Layer 1 — IP whitelist check (strict allowlist mode).
 * Independent from blacklist. Fails closed when client IP is missing.
 *
 * Returns:
 *   - { response }     — request is blocked (403)
 *   - { hit: true }    — whitelist active and the IP matched (trusted, skip blacklist)
 *   - { hit: false }   — whitelist not active or list empty (proceed normally)
 */
function checkIpWhitelist(
    c: Context<HonoCustomType>,
    settings: IpBlacklistSettings,
    reqIp: string | null
): { response?: Response; hit: boolean } {
    const active = !!(settings.enableWhitelist && settings.whitelist && settings.whitelist.length > 0);
    if (!active) return { hit: false };

    if (!reqIp) {
        console.warn(`Blocked request without cf-connecting-ip under whitelist mode for path: ${c.req.path}`);
        return { response: c.text(`Access denied: client IP unavailable`, 403), hit: false };
    }

    if (isWhitelisted(reqIp, settings.whitelist)) {
        return { hit: true };
    }

    console.warn(`Blocked non-whitelisted IP: ${reqIp} for path: ${c.req.path}`);
    return { response: c.text(`Access denied: IP ${reqIp} is not whitelisted`, 403), hit: false };
}

/**
 * Layer 2 — Blacklist check (IP + ASN + fingerprint), gated by the single `enabled` flag.
 * Returns a 403 Response if any blacklist hits, null otherwise.
 */
function checkBlacklist(
    c: Context<HonoCustomType>,
    settings: IpBlacklistSettings,
    reqIp: string
): Response | null {
    if (!settings.enabled) return null;

    // Check if IP is blacklisted (case-sensitive matching)
    if (settings.blacklist && settings.blacklist.length > 0) {
        if (isBlacklisted(reqIp, settings.blacklist, true)) {
            console.warn(`Blocked blacklisted IP: ${reqIp} for path: ${c.req.path}`);
            return c.text(`Access denied: IP ${reqIp} is blacklisted`, 403);
        }
    }

    // Check ASN organization blacklist (case-insensitive)
    if (settings.asnBlacklist && settings.asnBlacklist.length > 0) {
        const asOrganization = c.req.raw.cf?.asOrganization;
        if (asOrganization && isBlacklisted(asOrganization as string, settings.asnBlacklist, false)) {
            console.warn(`Blocked blacklisted ASN: ${asOrganization} (IP: ${reqIp}) for path: ${c.req.path}`);
            return c.text(`Access denied: ASN organization is blacklisted`, 403);
        }
    }

    // Check browser fingerprint blacklist (case-sensitive)
    if (settings.fingerprintBlacklist && settings.fingerprintBlacklist.length > 0) {
        const fingerprint = c.req.raw.headers.get("x-fingerprint");
        if (fingerprint && isBlacklisted(fingerprint, settings.fingerprintBlacklist, true)) {
            console.warn(`Blocked blacklisted fingerprint: ${fingerprint} (IP: ${reqIp}) for path: ${c.req.path}`);
            return c.text(`Access denied: Browser fingerprint is blacklisted`, 403);
        }
    }

    return null;
}

/**
 * Layer 3 — Daily request limit per IP. Always runs (protects backend resources).
 */
async function checkDailyLimit(
    c: Context<HonoCustomType>,
    settings: IpBlacklistSettings,
    reqIp: string
): Promise<Response | null> {
    if (!settings.enableDailyLimit || !settings.dailyRequestLimit || !c.env.KV) {
        return null;
    }

    const daily_count_key = `limit|${reqIp}|${new Date().toISOString().slice(0, 10)}`;
    const dailyLimit = settings.dailyRequestLimit;
    const current_count = parseInt(await c.env.KV.get(daily_count_key) || "0", 10);

    if (current_count && current_count >= dailyLimit) {
        console.warn(`Blocked IP ${reqIp} exceeded daily limit of ${dailyLimit} requests for path: ${c.req.path}`);
        return c.text(`IP=${reqIp} Exceeded daily limit of ${dailyLimit} requests`, 429);
    }

    // Increment counter with 24-hour expiration
    await c.env.KV.put(daily_count_key, ((current_count || 0) + 1).toString(), { expirationTtl: 24 * 60 * 60 });
    return null;
}

/**
 * Middleware to check access control for rate-limited endpoints.
 * Composes three independent layers in order:
 *   Layer 1 — IP whitelist (strict allowlist; hit = trust, skip blacklist)
 *   Layer 2 — Blacklist (IP / ASN / fingerprint)
 *   Layer 3 — Daily request limit
 *
 * Returns 403/429 response if blocked, null if allowed or any error occurs.
 */
export async function checkAccessControl(
    c: Context<HonoCustomType>
): Promise<Response | null> {
    try {
        const settings = await getIpBlacklistSettings(c);
        if (!settings) return null;

        const reqIp = c.req.raw.headers.get("cf-connecting-ip");

        // Layer 1: whitelist
        const whitelistResult = checkIpWhitelist(c, settings, reqIp);
        if (whitelistResult.response) return whitelistResult.response;

        // Without a client IP, skip IP-keyed layers below
        if (!reqIp) return null;

        // Layer 2: blacklist (skipped when whitelist trusted the IP)
        if (!whitelistResult.hit) {
            const blacklistResp = checkBlacklist(c, settings, reqIp);
            if (blacklistResp) return blacklistResp;
        }

        // Layer 3: daily limit (always enforced)
        return await checkDailyLimit(c, settings, reqIp);
    } catch (error) {
        // Log error but don't block request
        console.error('Error checking IP blacklist and rate limit:', error);
        return null;
    }
}
