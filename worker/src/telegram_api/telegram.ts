
import { Context } from "hono";
import { Telegraf, Context as TgContext, Markup } from "telegraf";
import { callbackQuery } from "telegraf/filters";

import { CONSTANTS } from "../constants";
import { getDomains, getJsonObjectValue, getStringValue } from '../utils';
import { TelegramSettings } from "./settings";
import { bindTelegramAddress, deleteTelegramAddress, jwtListToAddressData, tgUserNewAddress, unbindTelegramAddress, unbindTelegramByAddress } from "./common";
import { commonParseMail } from "../common";
import { UserFromGetMe } from "telegraf/types";
import i18n from "../i18n";


const getCommands = (lang: string) => {
    const t = i18n.getTelegramMessages(lang);
    return [
        { command: "start", description: t.commands.start },
        { command: "new", description: t.commands.new },
        { command: "address", description: t.commands.address },
        { command: "bind", description: t.commands.bind },
        { command: "unbind", description: t.commands.unbind },
        { command: "delete", description: t.commands.delete },
        { command: "mails", description: t.commands.mails },
        { command: "cleaninvalidaddress", description: t.commands.cleaninvalidaddress },
    ];
}

export function newTelegramBot(c: Context<HonoCustomType>, token: string): Telegraf {
    const bot = new Telegraf(token);
    const botInfo = getJsonObjectValue<UserFromGetMe>(c.env.TG_BOT_INFO);
    const lang = c.env.DEFAULT_LANG || "en";
    const t = i18n.getTelegramMessages(lang);
    const COMMANDS = getCommands(lang);
    
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
            return await ctx.reply(t.unableGetUserInfo);
        }

        const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
        if (settings?.enableAllowList && settings?.enableAllowList
            && !settings.allowList.includes(userId.toString())
        ) {
            return await ctx.reply(t.noPermission);
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
            t.welcome
            + (prefix ? `${t.currentPrefix}${prefix}\n` : '')
            + `${t.currentDomains}${JSON.stringify(domains)}\n`
            + t.pleaseUseCommands
            + COMMANDS.map(c => `/${c.command}: ${c.description}`).join("\n")
        );
    });

    bot.command("new", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply(t.unableGetUserInfo);
        }
        try {
            // @ts-ignore
            const address = ctx?.message?.text.slice("/new".length).trim();
            const res = await tgUserNewAddress(c, userId.toString(), address);
            return await ctx.reply(`${t.createSuccess}`
                + `${t.address}${res.address}\n`
                + (res.password ? `${t.password}\`${res.password}\`\n` : '')
                + `${t.credential}\`${res.jwt}\`\n`,
                {
                    parse_mode: "Markdown"
                }
            );
        } catch (e) {
            return await ctx.reply(`${t.createFailed}${(e as Error).message}`);
        }
    });

    bot.command("bind", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply(t.unableGetUserInfo);
        }
        try {
            // @ts-ignore
            const jwt = ctx?.message?.text.slice("/bind".length).trim();
            if (!jwt) {
                return await ctx.reply(t.pleaseInputCredential);
            }
            const address = await bindTelegramAddress(c, userId.toString(), jwt);
            return await ctx.reply(`${t.bindSuccess}`
                + `${t.address}${address}`
            );
        }
        catch (e) {
            return await ctx.reply(`${t.bindFailed}${(e as Error).message}`);
        }
    });

    bot.command("unbind", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply(t.unableGetUserInfo);
        }
        try {
            // @ts-ignore
            const address = ctx?.message?.text.slice("/unbind".length).trim();
            if (!address) {
                return await ctx.reply(t.pleaseInputAddress);
            }
            await unbindTelegramAddress(c, userId.toString(), address);
            return await ctx.reply(`${t.unbindSuccess}${address}`
            );
        }
        catch (e) {
            return await ctx.reply(`${t.unbindFailed}${(e as Error).message}`);
        }
    })

    bot.command("delete", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply(t.unableGetUserInfo);
        }
        try {
            // @ts-ignore
            const address = ctx?.message?.text.slice("/delete".length).trim();
            if (!address) {
                return await ctx.reply(t.pleaseInputAddress);
            }
            await deleteTelegramAddress(c, userId.toString(), address);
            return await ctx.reply(`${t.deleteSuccess}${address}`);
        } catch (e) {
            return await ctx.reply(`${t.deleteFailed}${(e as Error).message}`);
        }
    });

    bot.command("address", async (ctx) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply(t.unableGetUserInfo);
        }
        try {
            const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
            const { addressList } = await jwtListToAddressData(c, jwtList);
            return await ctx.reply(`${t.addressList}`
                + addressList.map(a => `${t.address}${a}`).join("\n")
            );
        } catch (e) {
            return await ctx.reply(`${t.getAddressListFailed}${(e as Error).message}`);
        }
    });

    bot.command("cleaninvalidaddress", async (ctx: TgContext) => {
        const userId = ctx?.message?.from?.id;
        if (!userId) {
            return await ctx.reply(t.unableGetUserInfo);
        }
        try {
            const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
            const { invalidJwtList } = await jwtListToAddressData(c, jwtList);
            const newJwtList = jwtList.filter(jwt => !invalidJwtList.includes(jwt));
            await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify(newJwtList));
            const { addressList } = await jwtListToAddressData(c, newJwtList);
            return await ctx.reply(`${t.cleanSuccess}`
                + `${t.currentAddressList}`
                + addressList.map(a => `${t.address}${a}`).join("\n")
            );
        } catch (e) {
            return await ctx.reply(`${t.cleanFailed}${(e as Error).message}`);
        }
    });

    const queryMail = async (ctx: TgContext, queryAddress: string, mailIndex: number, edit: boolean) => {
        const userId = ctx?.message?.from?.id || ctx.callbackQuery?.message?.chat?.id;
        if (!userId) {
            return await ctx.reply(t.unableGetUserInfo);
        }
        const jwtList = await c.env.KV.get<string[]>(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json') || [];
        const { addressList, addressIdMap } = await jwtListToAddressData(c, jwtList);
        if (!queryAddress && addressList.length > 0) {
            queryAddress = addressList[0];
        }
        if (!(queryAddress in addressIdMap)) {
            return await ctx.reply(`${t.addressNotBound}${queryAddress}`);
        }
        const address_id = addressIdMap[queryAddress];
        const db_address_id = await c.env.DB.prepare(
            `SELECT id FROM address where id = ? `
        ).bind(address_id).first("id");
        if (!db_address_id) {
            return await ctx.reply(t.invalidAddress);
        }
        const { raw, id: mailId, created_at } = await c.env.DB.prepare(
            `SELECT * FROM raw_mails where address = ? `
            + ` order by id desc limit 1 offset ?`
        ).bind(
            queryAddress, mailIndex
        ).first<{ raw: string, id: string, created_at: string }>() || {};
        const { mail } = raw ? await parseMail({ rawEmail: raw }, queryAddress, created_at) : { mail: t.noMoreMails };
        const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
        const miniAppButtons = []
        if (settings?.miniAppUrl && settings?.miniAppUrl?.length > 0 && mailId) {
            const url = new URL(settings.miniAppUrl);
            url.pathname = "/telegram_mail"
            url.searchParams.set("mail_id", mailId);
            miniAppButtons.push(Markup.button.webApp(t.viewMail, url.toString()));
        }
        if (edit) {
            return await ctx.editMessageText(mail || t.noMail,
                {
                    ...Markup.inlineKeyboard([
                        Markup.button.callback(t.previous, `mail_${queryAddress}_${mailIndex - 1}`, mailIndex <= 0),
                        ...miniAppButtons,
                        Markup.button.callback(t.next, `mail_${queryAddress}_${mailIndex + 1}`, !raw),
                    ])
                },
            );
        }
        return await ctx.reply(mail || t.noMail,
            {
                ...Markup.inlineKeyboard([
                    Markup.button.callback(t.previous, `mail_${queryAddress}_${mailIndex - 1}`, mailIndex <= 0),
                    ...miniAppButtons,
                    Markup.button.callback(t.next, `mail_${queryAddress}_${mailIndex + 1}`, !raw),
                ])
            },
        );
    }

    bot.command("mails", async ctx => {
        try {
            const queryAddress = ctx?.message?.text.slice("/mails".length).trim();
            return await queryMail(ctx, queryAddress, 0, false);
        } catch (e) {
            return await ctx.reply(`${t.getMailFailed}${(e as Error).message}`);
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
            console.log(`${t.getMailFailed}${(e as Error).message}`, e);
            return await ctx.answerCbQuery(`${t.getMailFailed}${(e as Error).message}`);
        }
        await ctx.answerCbQuery();
    });

    return bot;
}


export async function initTelegramBotCommands(bot: Telegraf, lang: string = "en") {
    const COMMANDS = getCommands(lang);
    await bot.telegram.setMyCommands(COMMANDS);
}

const parseMail = async (
    parsedEmailContext: ParsedEmailContext,
    address: string, created_at: string | undefined | null,
    lang: string = "en"
) => {
    const t = i18n.getTelegramMessages(lang);
    if (!parsedEmailContext.rawEmail) {
        return {};
    }
    try {
        const parsedEmail = await commonParseMail(parsedEmailContext);
        let parsedText = parsedEmail?.text || "";
        if (parsedText.length && parsedText.length > 1000) {
            parsedText = parsedEmail?.text.substring(0, 1000) + t.messageTooLong;
        }
        return {
            isHtml: false,
            mail: `${t.from}${parsedEmail?.sender || t.noSender}\n`
                + `${t.to}${address}\n`
                + (created_at ? `${t.date}${created_at}\n` : "")
                + `${t.subject}${parsedEmail?.subject}\n`
                + `${t.content}${parsedText || t.parseFailed}`
        };
    } catch (e) {
        return {
            isHtml: false,
            mail: `${t.parseMailFailed}${(e as Error).message}`
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
    const lang = c.env.DEFAULT_LANG || "en";
    const t = i18n.getTelegramMessages(lang);
    const userId = await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${address}`);
    const { mail } = await parseMail(parsedEmailContext, address, new Date().toUTCString(), lang);
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
        miniAppButtons.push(Markup.button.webApp(t.viewMail, url.toString()));
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
