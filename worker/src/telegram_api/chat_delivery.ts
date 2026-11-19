import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Update } from 'telegraf/types';
import { CONSTANTS } from '../constants';

type TelegramMembership = {
    blocked: boolean;
    observedAt: number;
    updateId: number;
};

const chatDeliveryKey = (env: Bindings, chatId: string) =>
    `${CONSTANTS.TG_KV_PREFIX}:delivery:${env.TELEGRAM_BOT_TOKEN.split(':', 1)[0]}:${String(chatId).toLowerCase()}`;

export const getTelegramWebhookSecret = (token: string): string =>
    createHmac('sha256', token).update('cloudflare-temp-email/telegram-webhook').digest('hex');

export const verifyTelegramWebhookSecret = (token: string, secret: string | undefined): boolean =>
    typeof secret === 'string' && /^[0-9a-f]{64}$/.test(secret)
    && timingSafeEqual(Buffer.from(secret), Buffer.from(getTelegramWebhookSecret(token)));

export const isTelegramChatBlocked = async (env: Bindings, chatId: string): Promise<boolean> => {
    const key = chatDeliveryKey(env, chatId);
    const [membership, failedAt] = await Promise.all([
        env.KV.get<TelegramMembership>(key, 'json'),
        env.KV.get<number>(`${key}:failure`, 'json'),
    ]);
    return membership?.blocked === true || (failedAt !== null && failedAt > (membership?.observedAt ?? 0));
};

export const recordTelegramChatBlocked = async (env: Bindings, chatId: string, sendStartedAt: number): Promise<void> => {
    const key = `${chatDeliveryKey(env, chatId)}:failure`;
    const failedAt = await env.KV.get<number>(key, 'json');
    if (failedAt !== null && failedAt >= sendStartedAt) return;

    await env.KV.put(key, JSON.stringify(sendStartedAt));
};

const saveTelegramMembership = async (env: Bindings, chatId: string, membership: TelegramMembership): Promise<void> => {
    const key = chatDeliveryKey(env, chatId);
    const previous = await env.KV.get<TelegramMembership>(key, 'json');
    if (previous && (previous.observedAt > membership.observedAt
        || (previous.observedAt === membership.observedAt && previous.updateId >= membership.updateId))) return;

    await env.KV.put(key, JSON.stringify(membership));
};

export const handleTelegramMembershipUpdate = async (env: Bindings, update: Update.MyChatMemberUpdate) => {
    const change = update.my_chat_member;
    if (!change?.chat || !change.new_chat_member
        || !Number.isSafeInteger(change.chat.id) || !Number.isSafeInteger(change.date)
        || !Number.isSafeInteger(update.update_id)) return;

    const member = change.new_chat_member;
    const status = member.status;
    if (status !== 'kicked' && status !== 'left' && status !== 'member'
        && status !== 'administrator' && status !== 'creator' && status !== 'restricted') return;

    const blocked = status === 'kicked' || status === 'left' || (status === 'restricted' && !member.is_member);
    // Telegram timestamps have second precision. A membership update wins over a send started in that second.
    const membership = { blocked, observedAt: change.date * 1000 + 999, updateId: update.update_id };
    const username = 'username' in change.chat ? change.chat.username : undefined;
    await Promise.all([
        saveTelegramMembership(env, String(change.chat.id), membership),
        username ? saveTelegramMembership(env, `@${username}`, membership) : undefined,
    ]);
};

export const isTelegramChatUnavailable = (code: number, description: unknown): boolean =>
    code === 403 && typeof description === 'string'
    && /\bbot (?:was blocked by the user|was kicked|is not a member of the (?:channel|group|supergroup) chat)\b/i.test(description);
