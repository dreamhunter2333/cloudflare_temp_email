import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import UserOauth2Callback from '../views/user/UserOauth2Callback.vue'
import i18n from '../i18n'
import { useGlobalState } from '../store'
import * as localeUtils from '../i18n-utils'

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
    const pathLocale = to.path.split('/')[1]
    const routeLocale = localeUtils.isSupportedLocale(pathLocale) ? pathLocale : null
    const resolvedLocale = routeLocale || localeUtils.getPreferredLocale(preferredLocale.value, localeUtils.getBrowserLocales())

    if (routeLocale === localeUtils.DEFAULT_LOCALE) {
        preferredLocale.value = localeUtils.DEFAULT_LOCALE
        i18n.global.locale.value = localeUtils.DEFAULT_LOCALE
        return next(localeUtils.replaceLocaleInFullPath(to.fullPath, localeUtils.DEFAULT_LOCALE))
    }

    i18n.global.locale.value = resolvedLocale

    if (routeLocale) {
        preferredLocale.value = routeLocale
    } else if (resolvedLocale !== localeUtils.DEFAULT_LOCALE) {
        preferredLocale.value = resolvedLocale
        return next(localeUtils.replaceLocaleInFullPath(to.fullPath, resolvedLocale))
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
