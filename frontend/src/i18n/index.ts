import { createI18n } from 'vue-i18n'

import {
    FALLBACK_LOCALE,
    getInitialLocale,
} from './utils'
import { I18N_MESSAGES } from './messages'

const i18n = createI18n({
    legacy: false, // you must set `false`, to use Composition API
    locale: getInitialLocale(),
    fallbackLocale: FALLBACK_LOCALE,
    messages: I18N_MESSAGES,
    missingWarn: false,
    fallbackWarn: false,
})

export default i18n;
