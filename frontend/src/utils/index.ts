import { getPathWithLocale } from '../i18n/utils'

export const hashPassword = async (password: string) => {
    // user crypto to hash password
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export const getRouterPathWithLang = (path: string, lang: string) => {
    const normalizedLang = lang === 'en'
        || lang === 'es'
        || lang === 'pt-BR'
        || lang === 'ja'
        || lang === 'de'
        ? lang
        : 'zh';

    return getPathWithLocale(path, normalizedLang);
}

export const utcToLocalDate = (utcDate: string | null | undefined, useUTCDate: boolean) => {
    if (!utcDate) return '';
    const utcDateString = `${utcDate} UTC`;
    if (useUTCDate) {
        return utcDateString;
    }
    try {
        const date = new Date(utcDateString);
        // if invalid date string
        if (isNaN(date.getTime())) return utcDateString;

        return date.toLocaleString();
    } catch (e) {
        console.error(e);
    }
    return utcDateString;
}

export const EXPIRY_PRESET_SECONDS: Record<string, number> = {
    '1h': 3600,
    '24h': 86400,
    '3d': 259200,
    '7d': 604800,
    '30d': 2592000,
};

export const resolveExpiryPayload = (
    expiryMode: string,
    customExpiresAt: number | null | undefined,
    nowMs: number = Date.now(),
): { expiresAt?: string } | null => {
    if (expiryMode === 'custom') {
        if (
            typeof customExpiresAt !== 'number'
            || !Number.isFinite(customExpiresAt)
            || Math.floor(customExpiresAt / 1000) <= Math.floor(nowMs / 1000)
        ) {
            return null;
        }
        const date = new Date(customExpiresAt);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return { expiresAt: date.toISOString() };
    }
    const seconds = Object.hasOwn(EXPIRY_PRESET_SECONDS, expiryMode)
        ? EXPIRY_PRESET_SECONDS[expiryMode]
        : undefined;
    if (seconds === undefined) return {};
    return { expiresAt: new Date(nowMs + seconds * 1000).toISOString() };
};
