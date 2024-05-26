import { createApp } from 'vue'
import App from './App.vue'
import { createI18n } from 'vue-i18n'
import router from './router'
import { registerSW } from 'virtual:pwa-register'
import { createHead } from '@unhead/vue'

registerSW({ immediate: true })
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
const head = createHead()
const app = createApp(App)
app.use(i18n)
app.use(router)
app.use(head)
app.mount('#app')
