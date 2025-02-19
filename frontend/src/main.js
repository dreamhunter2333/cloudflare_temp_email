import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createHead } from '@unhead/vue'

import i18n from './i18n'

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
