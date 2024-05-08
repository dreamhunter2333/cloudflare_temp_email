import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import UserLogin from '../views/user/UserLogin.vue'
import User from '../views/User.vue'
import SendMail from '../views/index/SendMail.vue'
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
            path: '/admin',
            component: Admin
        }
    ]
})

export default router
