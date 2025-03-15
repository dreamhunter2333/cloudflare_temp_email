import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import UserOauth2Callback from '../views/user/UserOauth2Callback.vue'
import i18n from '../i18n'
import { useGlobalState } from '../store'

const { jwt } = useGlobalState()

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
            path: '/user/oauth2/callback',
            alias: "/:lang/user/oauth2/callback",
            component: UserOauth2Callback
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
});


router.beforeEach((to, from, next) => {
    if (to.params.lang && ['en', 'zh'].includes(to.params.lang)) {
        i18n.global.locale.value = to.params.lang
    } else {
        i18n.global.locale.value = 'zh'
    }
    // check if query parameter has jwt, set it to store
    if (to.query.jwt) {
        jwt.value = to.query.jwt;
    }
    next()
});

export default router
