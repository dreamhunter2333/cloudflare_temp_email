import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import Admin from '../views/Admin.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: Index
        },
        {
            path: '/admin',
            component: Admin
        }
    ]
})

export default router
