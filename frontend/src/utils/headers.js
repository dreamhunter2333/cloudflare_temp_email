// Control characters (0x00-0x1F, plus DEL 0x7F) are forbidden in HTTP header
// values per RFC 7230. Sending them through axios / fetch raises
// "Invalid character in header content".
const hasControlChar = (str) => {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 32 || code === 127) return true;
    }
    return false;
};

/**
 * Returns a header value that is safe to attach to an outgoing request, or
 * `undefined` to mean "skip this header".
 *
 * Common reasons callers receive an unsafe value:
 *   - stale localStorage credentials carry a stray newline,
 *   - a missing token has been coerced to the literal string "undefined",
 *   - an empty placeholder ("") leaves us building "Bearer " with a trailing space.
 *
 * Returning `undefined` lets axios omit the header entirely, which yields a
 * clean 401 from the worker instead of a request-level crash on the client.
 */
export const safeHeaderValue = (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
        return undefined;
    }
    if (hasControlChar(trimmed)) return undefined;
    return trimmed;
};

/**
 * Build an Authorization: Bearer ... header from a raw JWT, or `undefined` if
 * the JWT is missing or unsafe.
 */
export const safeBearerHeader = (jwt) => {
    const safe = safeHeaderValue(jwt);
    return safe ? `Bearer ${safe}` : undefined;
};
