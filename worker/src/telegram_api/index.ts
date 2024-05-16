import { Hono, Context } from 'hono'
import { ServerResponse } from 'node:http'
import { Writable } from 'node:stream'
import { newTelegramBot, initTelegramBotCommands, sendMailToTelegram } from './telegram'

export const api = new Hono()
export { sendMailToTelegram }

api.post("/telegram/webhook", async (c: Context) => {
    const token = c.env.TELEGRAM_BOT_TOKEN;
    const bot = newTelegramBot(c, token);
    let body = null;
    const res = new Writable();
    Object.assign(res, {
        headersSent: false,
        setHeader: (name: string, value: string) => c.header(name, value),
        end: (data: any) => body = data,
    });
    const reqJson = await c.req.json();
    await bot.handleUpdate(reqJson, res as ServerResponse);
    return c.body(body);
});

api.post("/admin/telegram/init", async (c: Context) => {
    if (!c.env.TELEGRAM_BOT_TOKEN || !c.env.KV) {
        return c.text("TELEGRAM_BOT_TOKEN and KV are required", 400);
    }
    const domain = new URL(c.req.url).host;
    const token = c.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = `https://${domain}/telegram/webhook`;
    console.log(`setting webhook to ${webhookUrl}`);
    const bot = newTelegramBot(c, token);
    await bot.telegram.setWebhook(webhookUrl)
    await initTelegramBotCommands(bot);
    return c.json({
        message: "webhook set successfully",
    });
});

api.get("/admin/telegram/status", async (c: Context) => {
    if (!c.env.TELEGRAM_BOT_TOKEN || !c.env.KV) {
        return c.text("TELEGRAM_BOT_TOKEN and KV are required", 400);
    }
    const token = c.env.TELEGRAM_BOT_TOKEN;
    const bot = newTelegramBot(c, token);
    const info = await bot.telegram.getWebhookInfo()
    const commands = await bot.telegram.getMyCommands()
    return c.json({ info, commands });
});
