/**
 * Local rule-based verification code extraction.
 *
 * Extracts verification codes from email text without calling any AI model,
 * so mail content never leaves the regex engine inside the Worker.
 *
 * Pipeline:
 * 1. Normalize: strip zero-width characters, fold full-width digits and letters,
 *    and remove URLs / email addresses so their digits are never candidates.
 * 2. Try keyword-anchored patterns in priority order (keyword before code,
 *    code before keyword, keyword on the previous line).
 * 3. Only for verification-looking mails, fall back to a code on its own line
 *    or right after "use / enter / 输入".
 *
 * Every candidate must look like a code: 4-8 digits (not a year or YYYYMMDD
 * date), or 4-10 letters and digits containing at least one digit. Digits that
 * belong to amounts, decimals, times, phone numbers or longer numbers are never
 * taken as codes.
 *
 * Some keyword lists and test messages are adapted from 2FHey
 * (https://github.com/SoFriendly/2fhey, CC0-1.0).
 */

const KEYWORD_LIST = [
    // Chinese
    '验证码', '驗證碼', '校验码', '校驗碼', '认证码', '認證碼', '确认码', '確認碼', '动态码', '動態碼',
    '动态密码', '動態密碼', '动态口令', '短信口令', '安全码', '安全代码', '登录码', '登入码',
    '激活码', '一次性密码', '校验代码', '识别码', '随机码', '交易码', '(?<!源)代码',
    '(?:\\bOTP|动态|動態|一次性)\\s{0,3}密[码碼]',
    // Japanese
    '認証コード', '確認コード', '認証番号', '確認番号', 'ワンタイムパスワード', 'ワンタイムパスコード',
    'パスコード', 'セキュリティコード', '確認用コード',
    // Korean
    '인증\\s{0,3}코드', '인증\\s{0,3}번호', '확인\\s{0,3}코드', '보안\\s{0,3}코드',
    // English
    'verification\\s{0,3}code', 'verify\\s{0,3}code', 'confirm(?:ation)?\\s{0,3}code', 'security\\s{0,3}code',
    'log[\\s-]?in\\s{0,3}code', 'sign[\\s-]?in\\s{0,3}code', 'access\\s{0,3}code', 'auth(?:entication|orization)?\\s{0,3}code',
    'activation\\s{0,3}code', 'validation\\s{0,3}code', 'two[\\s-]?factor\\s{0,3}code', '2FA\\s{0,3}code',
    'one[\\s-]?time\\s{0,3}(?:pass(?:word|code)|code|pin)', '\\bpasscode', '\\bOTP\\b', '\\bPIN\\b', '\\bcaptcha',
    // Spanish / Portuguese
    'c[óo]digo(?!\\s{1,3}postal)(?:\\s{1,3}de\\s{1,3}(?:verificaci[óo]n|verifica[çc][ãa]o|seguridad|seguran[çc]a|acceso|acesso|confirmaci[óo]n|confirma[çc][ãa]o))?',
    // Italian
    'codice(?:\\s{1,3}di\\s{1,3}(?:sicurezza|verifica|conferma|accesso))?',
    // Turkish / Polish
    '(?<!\\p{L})kod(?:u|y)?(?!\\p{L})',
    // French
    'code\\s{1,3}(?:de\\s{1,3}(?:s[ée]curit[ée]|v[ée]rification|confirmation|connexion)|d[\'’](?:authentification|acc[èe]s|activation))',
    // German
    '(?:best[äa]tigungs|verifizierungs|sicherheits|anmelde|einmal|aktivierungs)code', 'einmalkennwort',
    // Russian / Ukrainian
    '(?<!\\p{L})код(?:\\s{1,3}подтверждения)?(?!\\p{L})',
    // Hebrew
    'קוד(?:\\s{1,3}(?:האימות|אימות))?',
    // Bare "code", excluding codes that are not verification codes
    // (the lookbehind runs after matching "code", so long runs of whitespace are never rescanned)
    '\\bcode\\b(?<!(?:promo|promotion|promotional|coupon|discount|gift|referral|invite|invitation|zip|postal|post|country|area|source|error|status|tracking|order|reference|ref|voucher|product|item|booking|qr|bar|redeem|redemption|html|sample)[\\s-]{0,3}code)',
];
const KW = `(?:${KEYWORD_LIST.join('|')})`;
// CJK keywords, used by the "123456（登录验证码）" pattern where no spaces separate words.
const CJK_KW = `(?:${KEYWORD_LIST.filter(k => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(k)).join('|')})`;

// Delimiter between keyword and code: colon, dash, "is" in several languages, or a CJK particle.
// \b is ASCII-only, so word boundaries use \p{L} lookarounds to also work for "é" / "è".
const DELIM = '\\s{0,3}(?:[:：=—–]|(?<!\\p{L})(?:is|was|ist|est|es|é|è)(?!\\p{L})|是|为|為|は|는|은|です|הוא)[\\s:：]{0,8}';
// Optional opening/closing bracket or quote around the code.
const OPEN = '[\\[【(（「『"\'“]?\\s{0,3}';
const CLOSE = '\\s{0,3}[\\]】)）」』"\'”]?';

// Not part of a larger number, amount, decimal, time or phone number.
const NUM_BEFORE = '(?<![\\w+\\-/])(?<!\\d[.,:：])(?<![$€£¥₹]\\s?)(?<!\\bRs\\.?\\s?)';
const NUM_AFTER = '(?![\\w/%]|[ -]\\d|[.,:]\\d|\\s?(?:USD|EUR|GBP|RMB|CNY|元|円|원))';
// Digit codes, optionally grouped (123-456, 591 204, 12 34 56, 8 4 9 2 0 1) or letter-prefixed (G-482913).
const DIGIT_CODE = `${NUM_BEFORE}(?:[A-Z]{1,3}-)?`
    + '(\\d{3}[ -]\\d{3}|\\d{4}[ -]\\d{4}|\\d{2}[ -]\\d{2}[ -]\\d{2}|\\d(?: \\d){3,7}|\\d{4,8})'
    + NUM_AFTER;
// Alphanumeric codes such as 7F3K9Q or K9X-4B2.
const ALNUM_CODE = '(?<![\\w\\-+/])([A-Za-z0-9]{3,5}-[A-Za-z0-9]{3,5}|[A-Za-z0-9]{4,10})(?![\\w\\-/]| \\d|[.,:]\\d)';
const ANY_CODE = `(?:${DIGIT_CODE}|${ALNUM_CODE})`;
// Words allowed between keyword and delimiter, e.g. "OTP for payment of Rs 5000 is".
// Tokens may not end with sentence punctuation, so the filler stays inside one sentence.
const FILLER = '(?:\\s{1,3}[^\\s。！？!?]{0,40}[^\\s。！？!?.,:])(?:\\s{1,3}[^\\s。！？!?]{0,40}[^\\s。！？!?.,:]){0,8}?';
// Words allowed between "123456 is your" and the keyword, e.g. "Google".
const NAME_FILLER = '(?:[\\p{L}\\d.\'’&-]{1,40}\\s{1,3}){0,4}';

const PATTERNS: RegExp[] = [
    // "verification code: 123456" / "验证码是 123-456" / "認証コードは 123456 です"
    new RegExp(`${KW}${DELIM}${OPEN}${DIGIT_CODE}${CLOSE}`, 'giu'),
    // "login code: 7F3K9Q" / "passcode: K9X-4B2"
    new RegExp(`${KW}${DELIM}${OPEN}${ALNUM_CODE}`, 'giu'),
    // "123456 is your Instagram code" / "ABC123 is your verification code" / "123456 est votre code de sécurité"
    // "123456 is OTP for your transfer" / "123456 ist dein Amazon-Einmalkennwort"
    new RegExp(`${ANY_CODE}\\s{1,3}(?:is|are|est|ist|es|é|è)\\s{1,3}(?:(?:your|the|votre|ihr|dein|deine|der|die|das|su|tu|il\\s{1,3}tuo|seu|o\\s{1,3}seu)\\s{1,3})?${NAME_FILLER}(?:\\p{L}{1,20}-)?${KW}`, 'giu'),
    // "123456 是您的验证码" / "116352（动态验证码）" / "123456短信登录验证码"
    new RegExp(`${ANY_CODE}\\s{0,3}[(（【\\[]?\\s{0,3}(?:是|为|為|は)?\\s{0,3}(?:您|你)?的?[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]{0,6}?${CJK_KW}`, 'giu'),
    // "123-456 — код для входа"
    new RegExp(`${ANY_CODE}\\s{0,3}[—–]\\s{0,3}${KW}`, 'giu'),
    // "OTP for payment of Rs 5000 is 482913" / "קוד האימות שלך הוא 123456"
    new RegExp(`${KW}${FILLER}${DELIM}${OPEN}${ANY_CODE}`, 'giu'),
    // "验证码123456" / "인증번호 [736251]" / "ワンタイムパスコード「123456」" (no delimiter, digits only)
    new RegExp(`${KW}\\s{0,3}${OPEN}${DIGIT_CODE}`, 'giu'),
    // "Enter this code to sign in\n 591 204" / "enter the code below:\nAB12CD" — code on its own line
    new RegExp(`${KW}[^\\n\\d]{0,60}\\n\\s{0,8}${OPEN}${ANY_CODE}${CLOSE}[ \\t]{0,8}(?:\\n|$)`, 'giu'),
];

// Phrases showing the mail asks the recipient to verify something; gate for the fallback patterns.
// Single words like "confirm", "verified" or "sign in" are deliberately not enough: they also
// appear in order confirmations, payment notices and most mail footers.
const VERIFY_TARGET = '(?:e-?mail(?:\\s{1,3}address)?|account|identity|registration|sign[\\s-]?(?:in|up)|log[\\s-]?in|device)';
const VERIFY_CONTEXT = new RegExp([
    KW,
    // "verify your email" / "confirm your account" / "authorize this transaction"
    `\\b(?:verify|confirm|activate|validate)\\s{1,3}(?:(?:your|this|the)\\s{1,3})?${VERIFY_TARGET}`,
    `\\b(?:e-?mail|account|identity|log[\\s-]?in|sign[\\s-]?in)\\s{1,3}(?:verification|confirmation|authentication)`,
    '\\bauthori[sz]e\\s{1,3}(?:(?:this|the|your)\\s{1,3})?(?:transaction|payment|login|sign[\\s-]?in|request|device)',
    '\\btwo[\\s-]?factor\\b|\\b2FA\\b',
    // zh / ja / ko
    '验证(?:您|你)?的?(?:邮箱|账号|帐号|账户|身份)|(?:邮箱|账号|帐号|身份|登录)验证|驗證(?:您|你)?的?(?:信箱|帳號|身分|身份)',
    '認証|인증',
    // ru / de / fr / es / pt / it
    'подтверд\\p{L}{0,20}\\s{1,3}(?:ваш\\p{L}{0,6}\\s{1,3})?(?:почт|e-?mail|аккаунт|учётн|учетн|вход|личност)',
    '(?:bestätigen|verifizieren)\\s{1,3}sie\\s{1,3}ihre\\s{1,3}(?:e-?mail|konto|identität)|(?:e-?mail|konto)[\\s-]?(?:adresse\\s{1,3})?(?:bestätigung|verifizierung)',
    'v[ée]rifi(?:er|ez)\\s{1,3}votre\\s{1,3}(?:adresse|e-?mail|compte|identit[ée])',
    'verific\\p{L}{0,20}\\s{1,3}(?:(?:tu|su|seu|sua|il\\s{1,3}tuo|la\\s{1,3}tua)\\s{1,3})?(?:correo|e-?mail|cuenta|conta|account|identidad|identidade|identità)',
].join('|'), 'iu');

const FALLBACK_PATTERNS: RegExp[] = [
    // A code on its own line, including the first line: "Please verify your email.\n\n706215" /
    // "706215\n\nPlease verify your email". The lookbehind skips numbers under a label line such as
    // "Account ID:", which are not codes.
    new RegExp(
        `(?:^|\\n)(?:[ \\t]{0,8}\\n){0,3}[ \\t]{0,8}(?<![:：][ \\t]{0,8}\\n(?:[ \\t]{0,8}\\n){0,3}[ \\t]{0,8})`
        + `${OPEN}${DIGIT_CODE}${CLOSE}[ \\t]{0,8}(?:\\n|$)`,
        'giu'
    ),
    // "Use 4821 to verify" / "Please use SGD-123456 within 3 minutes" / "请输入 123456"
    new RegExp(`(?:\\b(?:use|enter|input|type)|输入|填写|輸入|입력)\\s{0,3}${OPEN}${DIGIT_CODE}`, 'giu'),
];

// Verification codes appear near the top of a mail; bounding the input keeps
// the CPU time predictable within Workers limits for very large mails.
const MAX_TEXT_LENGTH = 20000;
// RFC 5322 limits a header line to 998 characters, so a real subject fits; a longer
// one is trimmed so it can never push the body out of MAX_TEXT_LENGTH.
const MAX_SUBJECT_LENGTH = 1000;

/**
 * Combine subject and body into the text passed to extractCode.
 * Many services put the code in the subject, e.g. "123456 is your verification code".
 */
export function joinSubjectAndBody(subject: string | undefined, body: string | undefined): string {
    return [subject?.slice(0, MAX_SUBJECT_LENGTH), body].filter(Boolean).join('\n\n');
}

export function extractCode(text: string): string | null {
    if (!text) return null;
    const normalized = normalizeText(text.slice(0, MAX_TEXT_LENGTH));

    for (const pattern of PATTERNS) {
        const code = findCode(normalized, pattern);
        if (code) return code;
    }

    if (!VERIFY_CONTEXT.test(normalized)) return null;

    for (const pattern of FALLBACK_PATTERNS) {
        const code = findCode(normalized, pattern);
        if (code) return code;
    }
    return null;
}

function normalizeText(text: string): string {
    return text
        // Zero-width and soft-hyphen characters sometimes split codes, e.g. "7\u200B4\u200C9"
        .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
        // Full-width digits and letters: １２３４５６ → 123456. CJK punctuation is kept,
        // so "123456，5分钟" is not read as the decimal "123456,5".
        .replace(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/\r\n?/g, '\n')
        // URLs and email addresses: their digits are never verification codes
        .replace(/\bhttps?:\/\/[^\s<>"']+/gi, ' ')
        .replace(/\bwww\.[^\s<>"']+/gi, ' ')
        .replace(/[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63}){1,8}/g, ' ');
}

function findCode(text: string, pattern: RegExp): string | null {
    for (const match of text.matchAll(pattern)) {
        const raw = match.slice(1).find(group => group !== undefined);
        const code = raw?.replace(/[ -]/g, '');
        if (code && isPlausibleCode(code)) return code;
    }
    return null;
}

function isPlausibleCode(code: string): boolean {
    if (/^\d+$/.test(code)) {
        return code.length >= 4 && code.length <= 8 && !looksLikeDate(code);
    }
    // Alphanumeric codes must contain a digit, so words like "EXPIRED" or "NEVER" are not codes.
    return code.length >= 4 && code.length <= 10 && /\d/.test(code) && /^[A-Za-z0-9]+$/.test(code);
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
