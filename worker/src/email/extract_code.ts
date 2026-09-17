/**
 * Local rule-based verification code extraction.
 *
 * Extracts verification codes from email text without calling any AI model,
 * so mail content never leaves the regex engine inside the Worker.
 * Covers common formats across English, Chinese, Japanese and Korean.
 *
 * Design principles:
 * 1. Prefer codes that appear next to an explicit code keyword, either
 *    "keyword: code" or "code is your ... keyword".
 * 2. Accept grouped codes ("123-456", "591 204") and letter prefixes
 *    ("G-482913"), returning only the code digits.
 * 3. Reject plausible dates/years (e.g. "2026", "20260411").
 * 4. Fall back to a standalone digit sequence ONLY when the mail looks like a
 *    verification mail, so invoices, order numbers and prices are not
 *    mistaken for codes.
 */

const CODE_KEYWORDS = [
    // Chinese
    '验证码', '驗證碼', '校验码', '认证码', '確認碼', '确认码', '动态码', '动态密码',
    '安全码', '登录码', '激活码', '一次性密码', '校验代码',
    // Japanese
    '認証コード', '確認コード', '認証番号', '確認番号', 'ワンタイムパスワード', 'セキュリティコード',
    // Korean
    '인증\\s*코드', '인증\\s*번호', '확인\\s*코드', '보안\\s*코드',
    // English
    'verification\\s*code', 'verify\\s*code', 'confirm(?:ation)?\\s*code', 'security\\s*code',
    'log[\\s-]*in\\s*code', 'sign[\\s-]*in\\s*code', 'access\\s*code', 'auth(?:entication)?\\s*code',
    'one[\\s-]*time\\s*(?:pass(?:word|code)|code|pin)', 'passcode', 'OTP', '2FA\\s*code', 'pin\\s*code',
    // Bare "code", excluding marketing / address codes
    '(?<!(?:promo|coupon|discount|gift|referral|invite|invitation|zip|postal|country|area|source|error|status)[\\s-]*)\\bcode',
].join('|');

// Words suggesting the mail is about verification; gate for the standalone fallback.
const VERIFY_CONTEXT = new RegExp(
    `${CODE_KEYWORDS}|verif|confirm|sign[\\s-]*in|log[\\s-]*in|authenticat|two[\\s-]*factor|2FA|`
    + '验证|驗證|登录|登入|校验|認証|ログイン|인증|로그인',
    'i'
);

// Delimiter between keyword and code: colon, "is", or a CJK particle.
const DELIM = '\\s*(?:[:：]|\\bis\\b|是|为|為|は|는|은|です)[\\s:：]*';
// Optional opening/closing bracket or quote around the code.
const OPEN = '[\\[【(（「『"\'“]?\\s*';
const CLOSE = '\\s*[\\]】)）」』"\'”]?';

// Digit codes, optionally grouped (123-456, 591 204, 12 34 56) or letter-prefixed (G-482913).
const DIGIT_CODE = '(?<![\\w-])(?:[A-Z]{1,3}-)?'
    + '(\\d{3}[ -]\\d{3}|\\d{4}[ -]\\d{4}|\\d{2}[ -]\\d{2}[ -]\\d{2}|\\d{4,8})'
    + '(?![\\w]|[ -]\\d)';
// Alphanumeric codes such as 7F3K9Q.
const ALNUM_CODE = '(?<![\\w-])([A-Za-z0-9]{4,10})(?![\\w-])';
// Filler allowed between "123456 is your" and the keyword, e.g. "Google".
const FILLER = '(?:[\\p{L}\\d.\'’&-]+\\s+){0,4}';

const PATTERNS: RegExp[] = [
    // "verification code: 123456" / "验证码是 123-456" / "認証コードは 123456 です"
    new RegExp(`(?:${CODE_KEYWORDS})${DELIM}${OPEN}${DIGIT_CODE}${CLOSE}`, 'iu'),
    // "123456 is your Instagram code" / "G-482913 is your Google verification code"
    new RegExp(`${DIGIT_CODE}\\s+(?:is|are)\\s+(?:your|the)\\s+${FILLER}(?:${CODE_KEYWORDS})`, 'iu'),
    // "123456 是您的验证码" / "123456 为你的登录验证码"
    new RegExp(`${DIGIT_CODE}\\s*(?:是|为|為)?\\s*(?:您|你)的[\\p{L}]{0,6}?(?:${CODE_KEYWORDS})`, 'iu'),
    // "验证码123456" / "인증번호 [123456]" (no delimiter, digits only)
    new RegExp(`(?:${CODE_KEYWORDS})\\s*${OPEN}${DIGIT_CODE}`, 'iu'),
    // "Enter this code to sign in\n 591 204" — code on its own line shortly after keyword
    new RegExp(`(?:${CODE_KEYWORDS})[^\\n\\d]{0,60}\\n[\\s]*${OPEN}${DIGIT_CODE}${CLOSE}[ \\t]*(?:\\n|$)`, 'iu'),
    // "login code: 7F3K9Q" (alphanumeric requires a delimiter)
    new RegExp(`(?:${CODE_KEYWORDS})${DELIM}${OPEN}${ALNUM_CODE}`, 'iu'),
];

const FALLBACK_PATTERNS: RegExp[] = [
    new RegExp(`(?:^|\\n)[ \\t]*${OPEN}${DIGIT_CODE}${CLOSE}[ \\t]*(?:\\n|$)`, 'iu'),
    new RegExp(`(?:\\b(?:use|enter|input|type)|输入|填写|輸入|입력)\\s*${OPEN}${DIGIT_CODE}`, 'iu'),
];

export function extractCode(text: string): string | null {
    if (!text) return null;

    for (const pattern of PATTERNS) {
        const code = findCode(text, pattern);
        if (code) return code;
    }

    if (!VERIFY_CONTEXT.test(text)) return null;

    // Fallback for verification-looking mails: digits on their own line, or
    // right after "use / enter / 输入". Digits elsewhere in the body (zip codes,
    // hotline numbers, reference numbers) are ignored.
    for (const pattern of FALLBACK_PATTERNS) {
        const code = findCode(text, pattern);
        if (code) return code;
    }
    return null;
}

function findCode(text: string, pattern: RegExp): string | null {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    for (const match of text.matchAll(global)) {
        const code = match[1]?.replace(/[ -]/g, '');
        if (code && isPlausibleCode(code)) return code;
    }
    return null;
}

function isPlausibleCode(code: string): boolean {
    if (code.length < 4 || code.length > 10) return false;
    if (/^\d+$/.test(code)) return !looksLikeDate(code);
    // Alphanumeric codes must mix in a digit, or be all uppercase letters,
    // so plain words like "Your" or "here" are not taken as codes.
    return /\d/.test(code) || /^[A-Z]+$/.test(code);
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
