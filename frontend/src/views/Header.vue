<script setup>
import { NGrid, NLayoutHeader, NInput } from 'naive-ui'
import { NButton, NSelect, NModal, NIcon, NMenu } from 'naive-ui'
import { NSwitch, NPopconfirm } from 'naive-ui'
import { ref, h, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useIsMobile } from '../utils/composables'
import { DarkModeFilled, DarkModeOutlined, StarOutlineFilled, MenuFilled } from '@vicons/material'

import { useGlobalState } from '../store'
import { api } from '../api'

const { jwt, localeCache, themeSwitch, showAuth, adminAuth, auth } = useGlobalState()
const router = useRouter()
const isMobile = useIsMobile()

const showLogin = ref(false)
const password = ref('')

const login = async () => {
    try {
        await api.getSettings()
        jwt.value = password.value;
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
}

const logout = () => {
    jwt.value = '';
    location.reload()
}

const authFunc = async () => {
    try {
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
}

const changeLocale = (locale) => {
    localeCache.value = locale;
    location.reload()
}

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            title: 'Cloudflare Temp Email',
            dark: 'Dark',
            light: 'Light',
            login: 'Login',
            logout: 'Logout',
            logoutConfirm: 'Are you sure to logout?',
            auth: 'Auth',
            authTip: 'Please enter the correct auth code',
        },
        zh: {
            title: 'Cloudflare 临时邮件',
            dark: '暗色',
            light: '亮色',
            login: '登录',
            logout: '登出',
            logoutConfirm: '确定要登出吗？',
            auth: '授权',
            authTip: '请输入正确的授权码',
        }
    }
});


const menuOptions = computed(() => [
    {
        label: () => h(
            NButton,
            {
                tertiary: true,
                ghost: true,
                onClick: () => router.push('/admin')
            },
            { default: () => "Admin" }
        ),
        show: !!adminAuth.value,
        key: "home"
    },
    {
        label: () => h(
            NButton,
            {
                tertiary: true,
                ghost: true,
                onClick: () => localeCache.value == 'zh' ? changeLocale('en') : changeLocale('zh')
            },
            {
                default: () => localeCache.value == 'zh' ? "English" : "中文"
            }
        ),
        key: "lang"
    },
    {
        label: () => h(
            NButton,
            {
                tertiary: true,
                ghost: true,
                onClick: () => { showLogin.value = true }
            },
            { default: () => t('login') }
        ),
        show: !jwt.value,
        key: "login"
    },
    {
        label: () => h(
            NPopconfirm,
            {
                onPositiveClick: () => logout()
            },
            {
                trigger: () => h(NButton, {
                    tertiary: true,
                    ghost: true,
                }, () => t('logout')
                ),
                default: () => t('logoutConfirm')
            }
        ),
        show: !!jwt.value,
        key: "logout"
    }
]);

const menuOptionsMobile = [
    {
        label: () => h(
            NIcon,
            {
                component: MenuFilled
            }
        ),
        key: "menu",
        children: menuOptions
    },
]
</script>

<template>
    <div>
        <n-layout-header>
            <div>
                <h2 v-if="!isMobile" style="display: inline-block; margin-left: 10px;">{{ t('title') }}</h2>
                <n-menu v-if="!isMobile" mode="horizontal" :options="menuOptions" />
                <n-menu v-else mode="horizontal" :options="menuOptionsMobile" />
            </div>
            <div>
                <n-switch v-model:value="themeSwitch" :size="isMobile ? 'small' : 'medium'">
                    <template #checked-icon>
                        <n-icon :component="DarkModeFilled" />
                    </template>
                    <template #unchecked-icon>
                        <n-icon :component="DarkModeOutlined" />
                    </template>
                </n-switch>
                <n-button tag="a" target="_blank" tertiary type="primary" round :size="isMobile ? 'small' : 'medium'"
                    href="https://github.com/dreamhunter2333/cloudflare_temp_email">
                    <n-icon :component="StarOutlineFilled" /> Github
                </n-button>
            </div>
        </n-layout-header>
        <n-modal v-model:show="showLogin" preset="dialog" title="Dialog">
            <template #header>
                <div>{{ t('login') }}</div>
            </template>
            <n-input v-model:value="password" type="textarea" :autosize="{
                minRows: 3
            }" />
            <template #action>
                <n-button @click="login" size="small" tertiary round type="primary">
                    {{ t('login') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
            title="Dialog">
            <template #header>
                <div>{{ t('auth') }}</div>
            </template>
            <p>{{ t('authTip') }}</p>
            <n-input v-model:value="auth" type="textarea" :autosize="{
                minRows: 3
            }" />
            <template #action>
                <n-button @click="authFunc" size="small" tertiary round type="primary">
                    {{ t('auth') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.n-layout-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
</style>
