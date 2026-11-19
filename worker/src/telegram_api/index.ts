import { Hono } from 'hono'
import { ServerResponse } from 'node:http'
import { Writable } from 'node:stream'
import type { Update } from 'telegraf/types'

import { newTelegramBot, initTelegramBotCommands, sendMailToTelegram } from './telegram'
import { getTelegramWebhookSecret, handleTelegramMembershipUpdate } from './chat_delivery'
import settings from './settings'
import miniapp from './miniapp'
import i18n from '../i18n'

export const api = new Hono<HonoCustomType>();
export { sendMailToTelegram }

api.use("/telegram/*", async (c, next) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!c.env.TELEGRAM_BOT_TOKEN) {
        return c.text(msgs.TgBotTokenRequiredMsg, 400);
    }
    if (!c.env.KV) {
        return c.text(msgs.KVNotAvailableMsg, 400);
    }
    return await next();
});

api.use("/admin/telegram/*", async (c, next) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!c.env.TELEGRAM_BOT_TOKEN) {
        return c.text(msgs.TgBotTokenRequiredMsg, 400);
    }
    if (!c.env.KV) {
        return c.text(msgs.KVNotAvailableMsg, 400);
    }
    return await next();
});

api.post("/telegram/webhook", async (c) => {
    const update = await c.req.json<Update>();
    if ('my_chat_member' in update) {
        await handleTelegramMembershipUpdate(c, update);
        return c.body(null, 200);
    }

    const bot = newTelegramBot(c, c.env.TELEGRAM_BOT_TOKEN);
    let body = null;
    const res = new Writable();
    Object.assign(res, {
        headersSent: false,
        setHeader: (name: string, value: string) => c.header(name, value),
        end: (data: any) => body = data,
    });
    await bot.handleUpdate(update, res as ServerResponse);
    return c.body(body);
});

api.post("/admin/telegram/init", async (c) => {
    const domain = new URL(c.req.url).host;
    const token = c.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = `https://${domain}/telegram/webhook`;
    console.log(`setting webhook to ${webhookUrl}`);
    const bot = newTelegramBot(c, token);
    await bot.telegram.setWebhook(webhookUrl, {
        allowed_updates: ["message", "callback_query", "my_chat_member"],
        secret_token: getTelegramWebhookSecret(token),
    });
    await initTelegramBotCommands(c, bot);
    return c.json({
        message: "webhook set successfully",
    });
});

api.get("/admin/telegram/status", async (c) => {
    const token = c.env.TELEGRAM_BOT_TOKEN;
    const bot = newTelegramBot(c, token);
    const info = await bot.telegram.getWebhookInfo()
    const commands = await bot.telegram.getMyCommands()
    return c.json({ info, commands });
});

api.get("/admin/telegram/settings", settings.getTelegramSettings);
api.post("/admin/telegram/settings", settings.saveTelegramSettings);
api.post("/telegram/get_bind_address", miniapp.getTelegramBindAddress);
api.post("/telegram/new_address", miniapp.newTelegramAddress);
api.post("/telegram/bind_address", miniapp.bindAddress);
api.post("/telegram/unbind_address", miniapp.unbindAddress);
api.post("/telegram/get_mail", miniapp.getMail);
