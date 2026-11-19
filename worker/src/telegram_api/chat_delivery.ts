import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Update } from 'telegraf/types';

const botId = (token: string) => token.split(':', 1)[0];

export const getTelegramWebhookSecret = (token: string): string =>
    createHmac('sha256', token).update('cloudflare-temp-email/telegram-webhook').digest('hex');

export const verifyTelegramWebhookSecret = (token: string, secret: string | undefined): boolean =>
    typeof secret === 'string' && /^[0-9a-f]{64}$/.test(secret)
    && timingSafeEqual(Buffer.from(secret), Buffer.from(getTelegramWebhookSecret(token)));

export const isTelegramChatBlocked = async (env: Bindings, chatId: string): Promise<boolean> =>
    (await env.DB.prepare(
        'SELECT blocked FROM telegram_chat_delivery WHERE bot_id = ? AND chat_id = ?'
    ).bind(botId(env.TELEGRAM_BOT_TOKEN), chatId).first<number>('blocked')) === 1;

const setTelegramChatBlocked = async (
    env: Bindings, chatId: string, blocked: boolean, observedAt: number, updateId: number
): Promise<void> => {
    await env.DB.prepare(
        `INSERT INTO telegram_chat_delivery (bot_id, chat_id, blocked, observed_at, update_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(bot_id, chat_id) DO UPDATE SET
            blocked = excluded.blocked, observed_at = excluded.observed_at, update_id = excluded.update_id
        WHERE (excluded.observed_at, excluded.update_id) >
            (telegram_chat_delivery.observed_at, telegram_chat_delivery.update_id)`
    ).bind(botId(env.TELEGRAM_BOT_TOKEN), chatId, blocked ? 1 : 0, observedAt, updateId).run();
};

export const recordTelegramChatBlocked = (env: Bindings, chatId: string, sendStartedAt: number): Promise<void> =>
    setTelegramChatBlocked(env, chatId, true, sendStartedAt, 0);

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
    await setTelegramChatBlocked(env, String(change.chat.id), blocked, change.date * 1000 + 999, update.update_id);
};

export const isTelegramChatUnavailable = (code: number, description: unknown): boolean =>
    code === 403 && typeof description === 'string'
    && /\bbot (?:was blocked by the user|was kicked|is not a member of the (?:channel|group|supergroup) chat)\b/i.test(description);
