import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import UserOauth2Callback from '../views/user/UserOauth2Callback.vue'
import i18n from '../i18n'
import { useGlobalState } from '../store'
import { api } from '../api'
import {
    DEFAULT_LOCALE,
    getBrowserLocales,
    getPreferredLocale,
    replaceLocaleInFullPath,
    resolveSupportedLocale,
} from '../i18n/utils'

const { jwt, preferredLocale, openSettings } = useGlobalState()

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            alias: '/:lang/',
            component: Index
        },
        {
            path: '/user',
            alias: '/:lang/user',
            component: User,
            meta: { requiresUserSystem: true }
        },
        {
            path: '/redeem',
            alias: '/:lang/redeem',
            component: () => import('../views/Redeem.vue')
        },
        {
            path: '/user/oauth2/callback',
            alias: '/:lang/user/oauth2/callback',
            component: UserOauth2Callback,
            meta: { requiresUserSystem: true }
        },
        {
            path: '/admin',
            alias: '/:lang/admin',
            component: () => import('../views/Admin.vue')
        },
        {
            path: '/telegram_mail',
            alias: '/:lang/telegram_mail',
            component: () => import('../views/telegram/Mail.vue')
        },
        {
            name: 'not-found',
            path: '/:pathMatch(.*)*',
            redirect: '/'
        }
    ]
});

router.beforeEach(async (to, from, next) => {
    const routeLocale = resolveSupportedLocale(to.path.split('/')[1])
    const resolvedLocale = routeLocale || DEFAULT_LOCALE
    i18n.global.locale.value = resolvedLocale

    if (routeLocale) {
        preferredLocale.value = routeLocale
    } else if (!preferredLocale.value) {
        preferredLocale.value = getPreferredLocale('', getBrowserLocales())
    }

    if (Object.prototype.hasOwnProperty.call(to.query, 'jwt')) {
        const jwtQuery = Array.isArray(to.query.jwt) ? to.query.jwt[0] : to.query.jwt
        if (typeof jwtQuery === 'string') {
            jwt.value = jwtQuery
        }
        const query = { ...to.query }
        delete query.jwt
        next({
            path: to.path,
            query,
            hash: to.hash,
            replace: true,
        })
        return
    }

    if (routeLocale) {
        const canonicalRoutePath = replaceLocaleInFullPath(to.fullPath, routeLocale)
        if (canonicalRoutePath !== to.fullPath) {
            return next(canonicalRoutePath)
        }
    }

    if (routeLocale === DEFAULT_LOCALE) {
        return next(replaceLocaleInFullPath(to.fullPath, DEFAULT_LOCALE))
    }

    if (to.meta.requiresUserSystem) {
        if (!openSettings.value.fetched) {
            const settings = await api.fetch('/open_api/settings');
            openSettings.value.disableUserSystem = settings.disableUserSystem === true;
        }
        if (openSettings.value.disableUserSystem) {
            return next(replaceLocaleInFullPath('/', resolvedLocale));
        }
    }

    next()
});

export default router
