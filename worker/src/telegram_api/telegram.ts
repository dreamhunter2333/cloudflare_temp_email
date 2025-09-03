
import { Context } from "hono";
import { Telegraf, Context as TgContext, Markup } from "telegraf";
import { callbackQuery } from "telegraf/filters";

import { CONSTANTS } from "../constants";
import { getDomains, getJsonObjectValue, getStringValue } from '../utils';
import { TelegramSettings } from "./settings";
import { bindTelegramAddress, deleteTelegramAddress, jwtListToAddressData, tgUserNewAddress, unbindTelegramAddress, unbindTelegramByAddress } from "./common";
import { commonParseMail } from "../common";
import { UserFromGetMe } from "telegraf/types";


const COMMANDS = [
    {
        command: "start",
        description: "开始使用"
    },
    {
        command: "new",
        description: "新建邮箱地址, 如果要自定义邮箱地址, 请输入 /new, 通过 /new <name>@<domain> 可以指定, name [a-z0-9] 有效, name 为空则随机生成, @<domain> 可选"
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
        command: "unbind",
        description: "解绑邮箱地址, 请输入 /unbind <邮箱地址>"
    },
    {
        command: "delete",
        description: "删除邮箱地址, 请输入 /delete <邮箱地址>"
    },
    {
        command: "mails",
        description: "查看邮件, 请输入 /mails <邮箱地址>, 不输入地址默认查看第一个地址"
    },
    {
        command: "cleaninvalidaddress",
        description: "清理无效地址, 请输入 /cleaninvalidaddress"
    },
]

export function newTelegramBot(c: Context<HonoCustomType>, token: string): Telegraf {
    const bot = new Telegraf(token);
    const botInfo = getJsonObjectValue<UserFromGetMe>(c.env.TG_BOT_INFO);
    if (botInfo) {
        bot.botInfo = botInfo;
    }

    bot.use(async (ctx, next) => {
        // check if in private chat
        if (ctx.chat?.type !== "private") {
            return;
        }

        const userId = ctx?.message?.from?.id || ctx.callbackQuery?.message?.chat?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }

        const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
        if (settings?.enableAllowList && settings?.enableAllowList
            && !settings.allowList.includes(userId.toString())
        ) {
            return await ctx.reply("您没有权限使用此机器人");
        }
        try {
            await next();
        } catch (error) {
            console.error(`Error: ${error}`);
            return await ctx.reply(`Error: ${error}`);
        }
    })

    bot.command("start", async (ctx: TgContext) => {
        const prefix = getStringValue(c.env.PREFIX)
        const domains = getDomains(c);
        return await ctx.reply(
            "欢迎使用本机器人, 您可以打开 mini app \n\n"
            + (prefix ? `当前已启用前缀: ${prefix}\n` : '')
            + `当前可用域名: ${JSON.stringify(domains)}\n`
            + "请使用以下命令:\n"
            + COMMANDS.map(c => `/${c.command}: ${c.description}`).join("\n")
        );
    });

    bot.command("new", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        try {
            // @ts-ignore
            const address = ctx?.message?.text.slice("/new".length).trim();
            const res = await tgUserNewAddress(c, userId.toString(), address);
            return await ctx.reply(`创建地址成功:\n`
                + `地址: ${res.address}\n`
                + `凭证: \`${res.jwt}\`\n`,
                {
                    parse_mode: "Markdown"
                }
            );
        } catch (e) {
            return await ctx.reply(`创建地址失败: ${(e as Error).message}`);
        }
    });

    bot.command("bind", async (ctx: TgContext) => {
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
            const address = await bindTelegramAddress(c, userId.toString(), jwt);
            return await ctx.reply(`绑定成功:\n`
                + `地址: ${address}`
            );
        }
        catch (e) {
            return await ctx.reply(`绑定失败: ${(e as Error).message}`);
        }
    });

    bot.command("unbind", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        try {
            // @ts-ignore
            const address = ctx?.message?.text.slice("/unbind".length).trim();
            if (!address) {
                return await ctx.reply("请输入地址");
            }
            await unbindTelegramAddress(c, userId.toString(), address);
            return await ctx.reply(`解绑成功:\n地址: ${address}`
            );
        }
        catch (e) {
            return await ctx.reply(`解绑失败: ${(e as Error).message}`);
        }
    })

    bot.command("delete", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        try {
            // @ts-ignore
            const address = ctx?.message?.text.slice("/delete".length).trim();
            if (!address) {
                return await ctx.reply("请输入地址");
            }
            await deleteTelegramAddress(c, userId.toString(), address);
            return await ctx.reply(`删除成功: ${address}`);
        } catch (e) {
            return await ctx.reply(`删除失败: ${(e as Error).message}`);
        }
    });

    bot.command("address", async (ctx) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        try {
            const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
            const { addressList } = await jwtListToAddressData(c, jwtList);
            return await ctx.reply(`地址列表:\n\n`
                + addressList.map(a => `地址: ${a}`).join("\n")
            );
        } catch (e) {
            return await ctx.reply(`获取地址列表失败: ${(e as Error).message}`);
        }
    });

    bot.command("cleaninvalidaddress", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        try {
            const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
            const { invalidJwtList } = await jwtListToAddressData(c, jwtList);
            const newJwtList = jwtList.filter(jwt => !invalidJwtList.includes(jwt));
            await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify(newJwtList));
            const { addressList } = await jwtListToAddressData(c, newJwtList);
            return await ctx.reply(`清理无效地址成功:\n\n`
                + `当前地址列表:\n\n`
                + addressList.map(a => `地址: ${a}`).join("\n")
            );
        } catch (e) {
            return await ctx.reply(`清理无效地址失败: ${(e as Error).message}`);
        }
    });

    const queryMail = async (ctx: TgContext, queryAddress: string, mailIndex: number, edit: boolean) => {
        const userId = ctx?.message?.from?.id || ctx.callbackQuery?.message?.chat?.id;
        if (!userId) {
            return await ctx.reply("无法获取用户信息");
        }
        const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
        const { addressList, addressIdMap } = await jwtListToAddressData(c, jwtList);
        if (!queryAddress && addressList.length > 0) {
            queryAddress = addressList[0];
        }
        if (!(queryAddress in addressIdMap)) {
            return await ctx.reply(`未绑定此地址 ${queryAddress}`);
        }
        const address_id = addressIdMap[queryAddress];
        const db_address_id = await c.env.DB.prepare(
            `SELECT id FROM address where id = ? `
        ).bind(address_id).first("id");
        if (!db_address_id) {
            return await ctx.reply("无效地址");
        }
        const { raw, id: mailId, created_at } = await c.env.DB.prepare(
            `SELECT * FROM raw_mails where address = ? `
            + ` order by id desc limit 1 offset ?`
        ).bind(
            queryAddress, mailIndex
        ).first<{ raw: string, id: string, created_at: string }>() || {};
        const { mail } = raw ? await parseMail({ rawEmail: raw }, queryAddress, created_at) : { mail: "已经没有邮件了" };
        const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
        const miniAppButtons = []
        if (settings?.miniAppUrl && settings?.miniAppUrl?.length > 0 && mailId) {
            const url = new URL(settings.miniAppUrl);
            url.pathname = "/telegram_mail"
            url.searchParams.set("mail_id", mailId);
            miniAppButtons.push(Markup.button.webApp("查看邮件", url.toString()));
        }
        if (edit) {
            return await ctx.editMessageText(mail || "无邮件",
                {
                    ...Markup.inlineKeyboard([
                        Markup.button.callback("上一条", `mail_${queryAddress}_${mailIndex - 1}`, mailIndex <= 0),
                        ...miniAppButtons,
                        Markup.button.callback("下一条", `mail_${queryAddress}_${mailIndex + 1}`, !raw),
                    ])
                },
            );
        }
        return await ctx.reply(mail || "无邮件",
            {
                ...Markup.inlineKeyboard([
                    Markup.button.callback("上一条", `mail_${queryAddress}_${mailIndex - 1}`, mailIndex <= 0),
                    ...miniAppButtons,
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
    await bot.telegram.setMyCommands(COMMANDS);
}

const parseMail = async (
    parsedEmailContext: ParsedEmailContext,
    address: string, created_at: string | undefined | null
) => {
    if (!parsedEmailContext.rawEmail) {
        return {};
    }
    try {
        const parsedEmail = await commonParseMail(parsedEmailContext);
        let parsedText = parsedEmail?.text || "";
        if (parsedText.length && parsedText.length > 1000) {
            parsedText = parsedEmail?.text.substring(0, 1000) + "\n\n...\n消息过长请到miniapp查看";
        }
        return {
            isHtml: false,
            mail: `From: ${parsedEmail?.sender || "无发件人"}\n`
                + `To: ${address}\n`
                + (created_at ? `Date: ${created_at}\n` : "")
                + `Subject: ${parsedEmail?.subject}\n`
                + `Content:\n${parsedText || "解析失败，请打开 mini app 查看"}`
        };
    } catch (e) {
        return {
            isHtml: false,
            mail: `解析邮件失败: ${(e as Error).message}`
        };
    }
}


export async function sendMailToTelegram(
    c: Context<HonoCustomType>, address: string,
    parsedEmailContext: ParsedEmailContext,
    message_id: string | null
) {
    if (!c.env.TELEGRAM_BOT_TOKEN || !c.env.KV) {
        return;
    }
    const userId = await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${address}`);
    const { mail } = await parseMail(parsedEmailContext, address, new Date().toUTCString());
    if (!mail) {
        return;
    }
    const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
    const globalPush = settings?.enableGlobalMailPush && settings?.globalMailPushList;
    if (!userId && !globalPush) {
        return;
    }
    const mailId = await c.env.DB.prepare(
        `SELECT id FROM raw_mails where address = ? and message_id = ?`
    ).bind(address, message_id).first<string>("id");
    const bot = newTelegramBot(c, c.env.TELEGRAM_BOT_TOKEN);
    const miniAppButtons = []
    if (settings?.miniAppUrl && settings?.miniAppUrl?.length > 0 && mailId) {
        const url = new URL(settings.miniAppUrl);
        url.pathname = "/telegram_mail"
        url.searchParams.set("mail_id", mailId);
        miniAppButtons.push(Markup.button.webApp("查看邮件", url.toString()));
    }
    if (globalPush) {
        for (const pushId of settings.globalMailPushList) {
            await bot.telegram.sendMessage(pushId, mail, {
                ...Markup.inlineKeyboard([
                    ...miniAppButtons,
                ])
            });
        }
    }
    if (!userId) {
        return;
    }
    await bot.telegram.sendMessage(userId, mail, {
        ...Markup.inlineKeyboard([
            ...miniAppButtons,
        ])
    });
}
