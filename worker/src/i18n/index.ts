import { LocaleMessages } from "./type";
import zh from "./zh";
import en from "./en";

export default {
    getMessages: (
        locale: string | null | undefined
    ): LocaleMessages => {
        // multi-language support
        if (locale === "en") return en;
        if (locale === "zh") return zh;

        // fallback language
        return en;
    }
}
