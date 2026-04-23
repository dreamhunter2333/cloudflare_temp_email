import { createAppI18n } from '@/i18n/app'

import {
    EMPTY_LOCALE_MESSAGES,
    FALLBACK_LOCALE,
    getInitialLocale,
} from './utils'

const i18n = createAppI18n({
    legacy: false, // you must set `false`, to use Composition API
    locale: getInitialLocale(),
    fallbackLocale: FALLBACK_LOCALE,
    messages: EMPTY_LOCALE_MESSAGES,
    missingWarn: false,
    fallbackWarn: false,
})

export default i18n;
