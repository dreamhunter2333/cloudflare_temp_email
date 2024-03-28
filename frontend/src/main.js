import { createApp } from 'vue'
import App from './App.vue'
import { createI18n } from 'vue-i18n'
import router from './router'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })
const i18n = createI18n({
    legacy: false, // you must set `false`, to use Composition API
    locale: 'zh', // set locale
    fallbackLocale: 'en', // set fallback locale
    'en': {
        messages: {}
    },
    'zhCN': {
        messages: {}
    }
})
const app = createApp(App)
app.use(i18n)
app.use(router)
app.mount('#app')
