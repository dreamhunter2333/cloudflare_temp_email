import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import UserOauth2Callback from '../views/user/UserOauth2Callback.vue'
import i18n from '../i18n'
import { useGlobalState } from '../store'
import * as localeUtils from '../i18n/utils'
import {
    applyLocaleNavigationState,
    getLocaleRedirectPath,
    getRouteLocale,
    resolveLocaleForNavigation,
    syncJwtFromQuery,
} from './locale-guard'

const { jwt, preferredLocale } = useGlobalState()

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            alias: localeUtils.buildLocaleAliases('/'),
            component: Index
        },
        {
            path: '/user',
            alias: localeUtils.buildLocaleAliases('/user'),
            component: User
        },
        {
            path: '/user/oauth2/callback',
            alias: localeUtils.buildLocaleAliases('/user/oauth2/callback'),
            component: UserOauth2Callback
        },
        {
            path: '/admin',
            alias: localeUtils.buildLocaleAliases('/admin'),
            component: () => import('../views/Admin.vue')
        },
        {
            path: '/telegram_mail',
            alias: localeUtils.buildLocaleAliases('/telegram_mail'),
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
    const routeLocale = getRouteLocale(to.path)
    const browserLocales = localeUtils.getBrowserLocales()
    const resolvedLocale = resolveLocaleForNavigation({
        routeLocale,
    })

    applyLocaleNavigationState({
        routeLocale,
        resolvedLocale,
        preferredLocaleRef: preferredLocale,
        browserLocales,
        i18n,
    })

    syncJwtFromQuery({
        query: to.query,
        jwtRef: jwt,
    })

    const redirectPath = getLocaleRedirectPath({
        fullPath: to.fullPath,
        routeLocale,
        resolvedLocale,
    })

    if (redirectPath) {
        return next(redirectPath)
    }

    next()
});

export default router
