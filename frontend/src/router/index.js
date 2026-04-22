import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import UserOauth2Callback from '../views/user/UserOauth2Callback.vue'
import i18n from '../i18n'
import { useGlobalState } from '../store'
import {
    buildLocaleAliases,
    DEFAULT_LOCALE,
    getBrowserLocales,
    getPreferredLocale,
    isSupportedLocale,
    replaceLocaleInFullPath,
} from '../i18n-utils'

const { jwt, preferredLocale } = useGlobalState()

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            alias: buildLocaleAliases('/'),
            component: Index
        },
        {
            path: '/user',
            alias: buildLocaleAliases('/user'),
            component: User
        },
        {
            path: '/user/oauth2/callback',
            alias: buildLocaleAliases('/user/oauth2/callback'),
            component: UserOauth2Callback
        },
        {
            path: '/admin',
            alias: buildLocaleAliases('/admin'),
            component: () => import('../views/Admin.vue')
        },
        {
            path: '/telegram_mail',
            alias: buildLocaleAliases('/telegram_mail'),
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
    const pathLocale = to.path.split('/')[1]
    const routeLocale = isSupportedLocale(pathLocale) ? pathLocale : null
    const resolvedLocale = routeLocale || getPreferredLocale(preferredLocale.value, getBrowserLocales())

    if (routeLocale === DEFAULT_LOCALE) {
        return next(replaceLocaleInFullPath(to.fullPath, DEFAULT_LOCALE))
    }

    i18n.global.locale.value = resolvedLocale

    if (routeLocale) {
        preferredLocale.value = routeLocale
    } else if (resolvedLocale !== DEFAULT_LOCALE) {
        preferredLocale.value = resolvedLocale
        return next(replaceLocaleInFullPath(to.fullPath, resolvedLocale))
    } else {
        preferredLocale.value = resolvedLocale
    }

    // check if query parameter has jwt, set it to store
    if (to.query.jwt) {
        jwt.value = to.query.jwt;
    }
    next()
});

export default router
