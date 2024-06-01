import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import { useGlobalState } from '../store'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            alias: "/:lang/",
            component: Index
        },
        {
            path: '/user',
            alias: "/:lang/user",
            component: User
        },
        {
            path: '/admin',
            alias: "/:lang/admin",
            component: () => import('../views/Admin.vue')
        },
        {
            path: '/telegram_mail',
            alias: "/:lang/telegram_mail",
            component: () => import('../views/telegram/Mail.vue')
        },
        {
            name: 'not-found',
            path: '/:pathMatch(.*)*',
            redirect: '/'
        }
    ]
})

export default router
