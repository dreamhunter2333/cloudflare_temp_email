import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'

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
            component: () => import('../views/Admin.vue')
        },
        {
            path: '/telegram_mail',
            component: () => import('../views/telegram/Mail.vue')
        },
    ]
})

export default router
