const MAX_CODE_CONTEXT_LENGTH = 120;

const htmlEntityMap: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ensp: " ",
    emsp: " ",
    thinsp: " ",
    zwnj: "",
    zwj: "",
};

export const decodeHtmlEntities = (value: string): string => {
    return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (entity, code: string) => {
        const lowerCode = code.toLowerCase();
        if (lowerCode.startsWith("#x")) {
            const charCode = parseInt(lowerCode.slice(2), 16);
            return Number.isFinite(charCode) ? String.fromCodePoint(charCode) : entity;
        }
        if (lowerCode.startsWith("#")) {
            const charCode = parseInt(lowerCode.slice(1), 10);
            return Number.isFinite(charCode) ? String.fromCodePoint(charCode) : entity;
        }
        return htmlEntityMap[lowerCode] ?? entity;
    });
};

export const htmlToPlainText = (html: string): string => {
    return decodeHtmlEntities(html)
        .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
        .replace(/<\s*br\s*\/?\s*>/gi, "\n")
        .replace(/<\s*\/\s*(p|div|tr|td|th|li|h[1-6]|table|section|article)\s*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[ \t\r\f\v]+/g, " ")
        .replace(/\n\s+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

export const buildSearchableMailText = (subject?: string, text?: string, html?: string): string => {
    return [subject || "", text || "", html ? htmlToPlainText(html) : ""]
        .filter(part => part.trim().length > 0)
        .join("\n");
};

const compactCandidateCode = (value: string): string => {
    return value.replace(/[\s\-_.:：]/g, "");
};

const isLikelyDateOrTime = (code: string, context: string): boolean => {
    if (/^(19|20)\d{2}$/.test(code)) {
        return true;
    }
    if (/^\d{8}$/.test(code) && /(?:date|日期|时间|time|expires?|过期|有效期)/i.test(context)) {
        return true;
    }
    if (/^\d{4}$/.test(code) && /[:：]\s*\d{2}/.test(context)) {
        return true;
    }
    return false;
};

const distanceToNearestKeyword = (context: string, codeStartInContext: number): number => {
    const keywordPattern = /(verification|verify|login|sign.?in|security|auth|authentication|one.?time|otp|passcode|code|pin|temporary|确认|验证|验证码|校验码|动态码|登录|登入|安全|口令|一次性|临时)/ig;
    let nearest = Number.POSITIVE_INFINITY;
    let match: RegExpExecArray | null;
    while ((match = keywordPattern.exec(context)) !== null) {
        const keywordStart = match.index;
        const keywordEnd = match.index + match[0].length;
        const distance = codeStartInContext < keywordStart
            ? keywordStart - codeStartInContext
            : Math.max(0, codeStartInContext - keywordEnd);
        nearest = Math.min(nearest, distance);
    }
    return nearest;
};

const scoreCandidate = (code: string, context: string, index: number, codeStartInContext: number): number => {
    let score = 0;

    if (code.length === 6) score += 30;
    if (code.length === 8) score += 20;
    if (code.length === 4) score += 10;
    if (code.length >= 5 && code.length <= 8) score += 10;

    const keywordDistance = distanceToNearestKeyword(context, codeStartInContext);
    if (Number.isFinite(keywordDistance)) {
        score += Math.max(0, 90 - keywordDistance);
    }
    if (/(验证码|校验码|动态码|一次性代码|登录代码|安全代码)/.test(context)) {
        score += 20;
    }
    if (/(openai|chatgpt|google|github|telegram|microsoft|apple|discord|cloudflare)/i.test(context)) {
        score += 15;
    }
    if (/\b(code|pin|otp)\b\s*(?:is|:|：|-)/i.test(context) || /(?:验证码|代码|校验码|动态码)\s*(?:是|为|:|：)/.test(context)) {
        score += 55;
    }
    if (/(?:expires?|expire|valid|有效|过期|分钟|minutes?|mins?)/i.test(context)) {
        score += 5;
    }
    if (isLikelyDateOrTime(code, context)) {
        score -= 100;
    }

    score -= Math.min(index / 100, 15);
    return score;
};

export const extractVerificationCode = (input: string): string => {
    const normalized = decodeHtmlEntities(input)
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
    const candidates: { code: string; score: number; index: number }[] = [];
    const seen = new Set<string>();
    const codePattern = /(?<!\d)(?:\d[\s\-_.:：]?){4,8}\d?(?!\d)/g;
    let match: RegExpExecArray | null;

    while ((match = codePattern.exec(normalized)) !== null) {
        const code = compactCandidateCode(match[0]);
        if (!/^\d{4,8}$/.test(code) || seen.has(code)) {
            continue;
        }
        const start = Math.max(0, match.index - MAX_CODE_CONTEXT_LENGTH);
        const end = Math.min(normalized.length, match.index + match[0].length + MAX_CODE_CONTEXT_LENGTH);
        const context = normalized.slice(start, end);
        const score = scoreCandidate(code, context, match.index, match.index - start);
        if (score > 0) {
            candidates.push({ code, score, index: match.index });
            seen.add(code);
        }
    }

    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    return candidates[0]?.code || "";
};
