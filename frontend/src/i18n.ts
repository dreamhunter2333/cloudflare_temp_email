import { createI18n } from 'vue-i18n'

import {
    EMPTY_LOCALE_MESSAGES,
    FALLBACK_LOCALE,
    getInitialLocale,
} from './i18n-utils'

const i18n = createI18n({
    legacy: false, // you must set `false`, to use Composition API
    locale: getInitialLocale(),
    fallbackLocale: FALLBACK_LOCALE,
    messages: EMPTY_LOCALE_MESSAGES,
    missingWarn: false,
    fallbackWarn: false,
})

export default i18n;
