import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import Admin from '../views/Admin.vue'
import TelegramMail from '../views/telegram/Mail.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: Index
        },
        {
            path: '/user',
            component: User
        },
        {
            path: '/admin',
            component: Admin
        },
        {
            path: '/telegram_mail',
            component: TelegramMail
        },
    ]
})

export default router
