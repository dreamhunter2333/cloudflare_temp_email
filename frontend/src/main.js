import { createApp } from 'vue'
import App from './App.vue'
import { createI18n } from 'vue-i18n'
import router from './router'
import { createHead } from '@unhead/vue'

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

router.beforeEach((to, from) => {
    if (to.params.lang && ['en', 'zh'].includes(to.params.lang)) {
        i18n.global.locale.value = to.params.lang
    } else {
        i18n.global.locale.value = 'zh'
    }
});


const head = createHead()
const app = createApp(App)
app.use(i18n)
app.use(router)
app.use(head)
app.mount('#app')
