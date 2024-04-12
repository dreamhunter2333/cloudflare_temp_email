import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import Settings from '../views/Settings.vue'
import SendMail from '../views/send/SendMail.vue'
import Admin from '../views/Admin.vue'
import SendBox from '../views/send/SendBox.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: Index
        },
        {
            path: '/settings',
            component: Settings
        },
        {
            path: '/send',
            component: SendMail
        },
        {
            path: '/sendbox',
            component: SendBox
        },
        {
            path: '/admin',
            component: Admin
        }
    ]
})

export default router
