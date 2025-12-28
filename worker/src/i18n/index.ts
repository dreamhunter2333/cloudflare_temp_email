import { LocaleMessages, TelegramMessages } from "./type";
import zh, { telegram as telegramZh } from "./zh";
import en, { telegram as telegramEn } from "./en";
import { Context } from "hono";

export default {
    getMessages: (
        locale: string | null | undefined
    ): LocaleMessages => {
        // multi-language support
        if (locale === "en") return en;
        if (locale === "zh") return zh;

        // fallback language
        return en;
    },
    getMessagesbyContext: (
        c: Context<HonoCustomType>
    ): LocaleMessages => {
        const locale = c.get("lang") || c.env.DEFAULT_LANG;
        // multi-language support
        if (locale === "en") return en;
        if (locale === "zh") return zh;

        // fallback language
        return en;
    },
    getTelegramMessages: (
        locale: string | null | undefined
    ): TelegramMessages => {
        // multi-language support
        if (locale === "en") return telegramEn;
        if (locale === "zh") return telegramZh;

        // fallback language
        return telegramEn;
    },
    getTelegramMessagesByContext: (
        c: Context<HonoCustomType>
    ): TelegramMessages => {
        const locale = c.get("lang") || c.env.DEFAULT_LANG;
        // multi-language support
        if (locale === "en") return telegramEn;
        if (locale === "zh") return telegramZh;

        // fallback language
        return telegramEn;
    }
}
