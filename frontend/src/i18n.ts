import { createI18n } from 'vue-i18n'

import {
    FALLBACK_LOCALE,
    getBrowserLocales,
    getPreferredLocale,
    getStoredLocale,
    SUPPORTED_LOCALES,
} from './i18n-utils'

const locale = getPreferredLocale(getStoredLocale(), getBrowserLocales())
const messages = Object.fromEntries(
    SUPPORTED_LOCALES.map((supportedLocale) => [supportedLocale, {}])
)

const i18n = createI18n({
    legacy: false, // you must set `false`, to use Composition API
    locale,
    fallbackLocale: FALLBACK_LOCALE,
    messages,
    missingWarn: false,
    fallbackWarn: false,
})

export default i18n;
