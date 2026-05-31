/**
 * Regex-based verification code extraction.
 *
 * Extracts verification codes (4-12 digit / alphanumeric) from email text.
 * Covers common formats across English, Chinese, Japanese and Korean.
 *
 * This is a zero-dependency fallback used when Workers AI is not bound, so
 * self-hosted deployments without Workers AI still surface verification codes.
 *
 * Design principles (learned from QA):
 * 1. Prefer codes that appear after an explicit code keyword.
 * 2. Reject plausible dates/years (e.g. "2026", "20260411") — too common as
 *    date markers in subject lines, almost never a real verification code.
 * 3. Allow multi-character delimiters (a keyword followed by a colon or "is").
 * 4. Fall back to standalone digits ONLY if no keyword-guided match found
 *    AND the digits don't look like a year or YYYYMMDD date.
 */
export function extractCode(text: string): string | null {
    // DELIM: at least one explicit delimiter must follow the code keyword before
    // the code itself. Allowed delimiters: an ASCII or full-width colon, the word
    // "is", or a common CJK delimiter particle (see the DELIM regex below).
    // Multiple delimiters in sequence are OK. Whitespace around them is allowed.
    //
    // Why mandatory: without a delimiter, "verification code Your email" would
    // capture "Your" as a false alphanumeric code. Bare "verification code 123456"
    // without any delimiter still falls through to the standalone-digit fallback.
    const DELIM = '\\s*(?:[:：]|\\bis\\b|是|为|です)[\\s:：]*';

    // Keyword groups — labels that precede a verification code
    const CN_JA_KO_KW = '验证码|认证码|确认码|認証コード|인증\\s*코드|코드';
    const EN_KW = 'verification\\s*code|confirm(?:ation)?\\s*code|security\\s*code|passcode|OTP|pin\\s*code';
    const ALL_KW = `${CN_JA_KO_KW}|${EN_KW}`;

    const keywordPatterns = [
        // 1. "code is 123456" / "code: 123456" — numeric preferred (bare "code" keyword)
        new RegExp(`\\bcode${DELIM}(\\d{4,12})\\b`, 'i'),
        // 2. Full keyword + mandatory delimiter + digits
        new RegExp(`(?:${ALL_KW})${DELIM}(\\d{4,12})\\b`, 'i'),
        // 3. Bare "code" + delimiter + alphanumeric
        new RegExp(`\\bcode${DELIM}([A-Za-z0-9]{4,12})\\b`, 'i'),
        // 4. Full keyword + delimiter + alphanumeric
        new RegExp(`(?:${ALL_KW})${DELIM}([A-Za-z0-9]{4,12})\\b`, 'i'),
    ];

    for (const pattern of keywordPatterns) {
        const match = text.match(pattern);
        if (match?.[1] && !looksLikeDate(match[1])) return match[1];
    }

    // Fallback: standalone digit sequence, but reject year/date patterns
    const standaloneMatch = text.match(/(?:^|\s)(\d{4,12})(?:\s|$|\.|,)/m);
    if (standaloneMatch?.[1] && !looksLikeDate(standaloneMatch[1])) {
        return standaloneMatch[1];
    }

    return null;
}

/**
 * Heuristic: does this digit sequence look like a date/year we should reject?
 * - 4 digits matching 19xx or 20xx → year (e.g. 2026)
 * - 8 digits matching YYYYMMDD with plausible month/day → date (e.g. 20260411)
 */
function looksLikeDate(digits: string): boolean {
    // 4-digit year: 1900-2099
    if (digits.length === 4) {
        const n = parseInt(digits, 10);
        if (n >= 1900 && n <= 2099) return true;
    }
    // 8-digit YYYYMMDD
    if (digits.length === 8) {
        const year = parseInt(digits.slice(0, 4), 10);
        const month = parseInt(digits.slice(4, 6), 10);
        const day = parseInt(digits.slice(6, 8), 10);
        if (year >= 1900 && year <= 2099 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return true;
        }
    }
    return false;
}
