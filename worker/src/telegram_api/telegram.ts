
import { Context } from "hono";
import { Jwt } from 'hono/utils/jwt'
import { Telegraf, Context as TgContext, Markup } from "telegraf";
import { callbackQuery } from "telegraf/filters";
import PostalMime from 'postal-mime';

import { CONSTANTS } from "../constants";
// @ts-ignore
import { getIntValue, getDomains, getStringValue } from '../utils';
// @ts-ignore
import { newAddress } from '../common'

const COMMANDS = [
    {
        command: "start",
        description: "开始使用"
    },
    {
        command: "new",
        description: "新建邮箱地址, 如果要自定义邮箱地址, 请输入 /new <name>@<domain>, name [a-zA-Z0-9.] 有效"
    },
    {
        command: "address",
        description: "查看邮箱地址列表"
    },
    {
        command: "bind",
        description: "绑定邮箱地址, 请输入 /bind <邮箱地址凭证>"
    },
    {
        command: "mails",
        description: "查看邮件, 请输入 /mails <邮箱地址>, 不输入地址默认查看第一个地址"
    },
]

export function newTelegramBot(c: Context, token: string): Telegraf {
    const bot = new Telegraf(token);
    bot.command("start", async (ctx: TgContext) => {
        if (ctx.chat?.type !== "private") {
            return await ctx.reply("请在私聊中使用");
        }
        const prefix = getStringValue(c.env.PREFIX)
        const domains = getDomains(c);
        return await ctx.reply(
            "欢迎使用本机器人\n\n"
            + (prefix ? `当前已启用前缀: ${prefix}\n` : '')
            + "新建邮箱地址, 如果要自定义邮箱地址, "
            + "请输入 /new <name>@<domain>, name [a-zA-Z0-9.] 有效\n"
            + `当前可用域名: ${JSON.stringify(domains)}\n`
            + "请使用以下命令:\n"
            + COMMANDS.map(c => `/${c.command}: ${c.description}`).join("\n")
        );
    });
    bot.command("new", async (ctx: TgContext) => {
        if (ctx.chat?.type !== "private") {
            return await ctx.reply("请在私聊中使用");
        }
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        try {
            // @ts-ignore
            const address = ctx?.message?.text.slice("/new".length).trim();
            if (!address) {
                return await ctx.reply("请输入邮箱地址");
            }
            const [name, domain] = address.includes("@") ? address.split("@") : [address, null];
            const jwtList = await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, { type: 'json' }) || [];
            if (jwtList.length >= getIntValue(c.env.TG_MAX_ADDRESS, 5)) {
                return await ctx.reply("绑定地址数量已达上限");
            }
            const res = await newAddress(c, name, domain, true);
            // for mail push to telegram
            await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify([...jwtList, res.jwt]));
            await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${res.address}`, userId);
            return await ctx.reply(`创建地址成功:\n`
                + `地址: ${res.address}\n`
                + `凭证: ${res.jwt}\n`
            );
        } catch (e) {
            return await ctx.reply(`创建地址失败: ${(e as Error).message}`);
        }
    });

    bot.command("bind", async (ctx: TgContext) => {
        if (ctx.chat?.type !== "private") {
            return await ctx.reply("请在私聊中使用");
        }
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        try {
            // @ts-ignore
            const jwt = ctx?.message?.text.slice("/bind".length).trim();
            if (!jwt) {
                return await ctx.reply("请输入凭证");
            }
            const { address } = await Jwt.verify(jwt, c.env.JWT_SECRET, "HS256");
            if (!address) {
                return await ctx.reply("凭证无效");
            }
            const jwtList = await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, { type: 'json' }) || [];
            if (jwtList.length >= getIntValue(c.env.TG_MAX_ADDRESS, 5)) {
                return await ctx.reply("绑定地址数量已达上限");
            }
            await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify([...jwtList, jwt]));
            // for mail push to telegram
            await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${address}`, userId);
            return await ctx.reply(`绑定成功:\n`
                + `地址: ${address}`
            );
        }
        catch (e) {
            return await ctx.reply(`绑定失败: ${(e as Error).message}`);
        }
    });

    bot.command("address", async (ctx: TgContext) => {
        if (ctx.chat?.type !== "private") {
            return await ctx.reply("请在私聊中使用");
        }
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        try {
            const jwtList = await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, { type: 'json' }) || [];
            const addressList = [];
            for (const jwt of jwtList) {
                try {
                    const { address } = await Jwt.verify(jwt, c.env.JWT_SECRET, "HS256");
                    addressList.push(address);
                } catch (e) {
                    addressList.push("此凭证无效");
                    continue;
                }
            }
            return await ctx.reply(`地址列表:\n\n`
                + addressList.map(a => `地址: ${a}`).join("\n")
            );
        } catch (e) {
            return await ctx.reply(`获取地址列表失败: ${(e as Error).message}`);
        }
    });

    const queryMail = async (ctx: TgContext, queryAddress: string, mailIndex: number, edit: boolean) => {
        const userId = ctx?.message?.from?.id || ctx.callbackQuery?.message?.chat?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        const jwtList = await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, { type: 'json' }) || [];
        const addressList = [];
        for (const jwt of jwtList) {
            try {
                const { address } = await Jwt.verify(jwt, c.env.JWT_SECRET, "HS256");
                addressList.push(address);
            } catch (e) {
                addressList.push("此凭证无效");
                continue;
            }
        }
        if (!queryAddress && addressList.length > 0) {
            queryAddress = addressList[0];
        }
        if (!addressList.includes(queryAddress)) {
            return await ctx.reply(`未绑定此地址 ${queryAddress}`);
        }
        const raw = await c.env.DB.prepare(
            `SELECT * FROM raw_mails where address = ? `
            + ` order by id desc limit 1 offset ?`
        ).bind(
            queryAddress, mailIndex
        ).first("raw");
        const { mail } = await parseMail(raw);
        if (edit) {
            return await ctx.editMessageText(mail || "无邮件",
                {
                    ...Markup.inlineKeyboard([
                        Markup.button.callback("上一条", `mail_${queryAddress}_${mailIndex - 1}`, mailIndex <= 0),
                        Markup.button.callback("下一条", `mail_${queryAddress}_${mailIndex + 1}`, !raw),
                    ])
                },
            );
        }
        return await ctx.reply(mail || "无邮件",
            {
                ...Markup.inlineKeyboard([
                    Markup.button.callback("上一条", `mail_${queryAddress}_${mailIndex - 1}`, mailIndex <= 0),
                    Markup.button.callback("下一条", `mail_${queryAddress}_${mailIndex + 1}`, !raw),
                ])
            },
        );
    }

    bot.command("mails", async ctx => {
        try {
            const queryAddress = ctx?.message?.text.slice("/mails".length).trim();
            return await queryMail(ctx, queryAddress, 0, false);
        } catch (e) {
            return await ctx.reply(`获取邮件失败: ${(e as Error).message}`);
        }
    });

    bot.on(callbackQuery("data"), async ctx => {
        // Use ctx.callbackQuery.data
        try {
            const data = ctx.callbackQuery.data;
            if (data && data.startsWith("mail_") && data.split("_").length === 3) {
                const [_, queryAddress, mailIndex] = data.split("_");
                await queryMail(ctx, queryAddress, parseInt(mailIndex), true);
            }
        }
        catch (e) {
            console.log(`获取邮件失败: ${(e as Error).message}`, e);
            return await ctx.answerCbQuery(`获取邮件失败: ${(e as Error).message}`);
        }
        await ctx.answerCbQuery();
    });

    return bot;
}


export async function initTelegramBotCommands(bot: Telegraf) {
    bot.telegram.sendMessage
    await bot.telegram.setMyCommands(COMMANDS);
}

const parseMail = async (raw_mail: string) => {
    if (!raw_mail) {
        return {};
    }
    try {
        const parsedEmail = await PostalMime.parse(raw_mail);
        return {
            isHtml: false,
            mail: `From: ${parsedEmail.from ? `${parsedEmail.from.name}[${parsedEmail.from.address}]` : "无发件人"}\n`
                + `To: ${parsedEmail.to?.map(t => `${t.name}[${t.address}]`).join(" ")}\n`
                + `Subject: ${parsedEmail.subject}\n`
                + `Date: ${parsedEmail.date}\n`
                + `Content:\n${parsedEmail.text?.substring(0, 100) || "解析失败"}`
        };
    } catch (e) {
        return {
            isHtml: false,
            mail: `解析邮件失败: ${(e as Error).message}`
        };
    }
}


export async function sendMailToTelegram(c: Context, address: string, raw_mail: string) {
    if (!c.env.TELEGRAM_BOT_TOKEN || !c.env.KV) {
        return;
    }
    const userId = await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${address}`);
    if (!userId) {
        return;
    }
    const { mail } = await parseMail(raw_mail);
    if (!mail) {
        return;
    }
    const bot = newTelegramBot(c, c.env.TELEGRAM_BOT_TOKEN);
    await bot.telegram.sendMessage(userId, mail);
}
