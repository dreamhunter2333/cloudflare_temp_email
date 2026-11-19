import type { Context } from 'hono';
import type i18n from '../i18n';
import { getBooleanValue } from '../utils';

export const isAddressExpiryEnabled = (c: Context<HonoCustomType>): boolean =>
    getBooleanValue(c.env.ENABLE_ADDRESS_EXPIRY);

export const isAddressExpired = (
    c: Context<HonoCustomType>,
    expiresAt: string | null | undefined,
): boolean => {
    if (!expiresAt || !isAddressExpiryEnabled(c)) return false;
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(expiresAt)
        ? `${expiresAt.replace(' ', 'T')}Z`
        : expiresAt;
    const ts = Date.parse(normalized);
    return Number.isFinite(ts) && ts <= Date.now();
};

export const shouldRejectExpiryInput = (
    c: Context<HonoCustomType>,
    expiresAt: unknown,
): boolean => !isAddressExpiryEnabled(c) && expiresAt != null;

export const normalizeAddressExpiresAt = (
    expiresAt: unknown,
    msgs: ReturnType<typeof i18n.getMessagesbyContext>
): string => {
    let timestamp = NaN;
    if (typeof expiresAt === 'number') {
        timestamp = expiresAt;
    } else if (typeof expiresAt === 'string') {
        const trimmed = expiresAt.trim();
        const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
            ? `${trimmed.replace(' ', 'T')}Z`
            : trimmed;
        const isoDate = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.exec(normalized);
        if (!isoDate) {
            throw new Error(msgs.InvalidExpiresAtMsg);
        }
        const [year, month, day] = isoDate.slice(1).map(Number);
        const calendarDate = new Date(Date.UTC(year, month - 1, day));
        if (
            calendarDate.getUTCFullYear() !== year
            || calendarDate.getUTCMonth() !== month - 1
            || calendarDate.getUTCDate() !== day
        ) {
            throw new Error(msgs.InvalidExpiresAtMsg);
        }
        timestamp = Date.parse(normalized);
    }
    if (!Number.isFinite(timestamp) || Math.floor(timestamp / 1000) <= Math.floor(Date.now() / 1000)) {
        throw new Error(msgs.InvalidExpiresAtMsg);
    }
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() >= 2100) {
        throw new Error(msgs.InvalidExpiresAtMsg);
    }
    return date.toISOString().slice(0, 19).replace('T', ' ');
}
