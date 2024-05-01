import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import SendMail from '../views/send/SendMail.vue'
import Admin from '../views/Admin.vue'

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
            path: '/send',
            component: SendMail
        },
        {
            path: '/admin',
            component: Admin
        }
    ]
})

export default router
