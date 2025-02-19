import { createI18n } from 'vue-i18n'

const i18n = createI18n({
    legacy: false, // you must set `false`, to use Composition API
    locale: 'zh', // set locale
    fallbackLocale: 'en', // set fallback locale
    'en': {
        messages: {}
    },
    'zh': {
        messages: {}
    }
})

export default i18n;
