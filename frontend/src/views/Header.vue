<script setup>
import { NGrid, NLayoutHeader, NInput } from 'naive-ui'
import { NButton, NSelect, NModal } from 'naive-ui'
import { NSwitch, NPopconfirm } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../store'
import { api } from '../api'

const { jwt, localeCache, themeSwitch, showAuth, adminAuth, auth } = useGlobalState()
const router = useRouter()
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
</script>

<template>
    <n-layout-header>
        <div>
            <h2>{{ t('title') }}</h2>
        </div>
        <div>
            <n-button v-if="localeCache == 'zh'" @click="changeLocale('en')">English</n-button>
            <n-button v-else @click="changeLocale('zh')">中文</n-button>
            <n-button v-if="adminAuth" tertiary @click="() => router.push('/admin')" type="primary">
                Admin
            </n-button>
            <n-switch v-model:value="themeSwitch">
                <template #checked>
                    {{ t('dark') }}
                </template>
                <template #unchecked>
                    {{ t('light') }}
                </template>
            </n-switch>
            <n-popconfirm v-if="jwt" @positive-click="logout">
                <template #trigger>
                    <n-button tertiary round type="primary">
                        {{ t('logout') }}
                    </n-button>
                </template>
                <template #default>
                    <span>
                        {{ t('logoutConfirm') }}
                    </span>
                </template>
            </n-popconfirm>
            <n-button v-else tertiary @click="showLogin = true" round type="primary">
                {{ t('login') }}
            </n-button>
            <n-button tag="a" target="_blank" tertiary type="primary" round
                href="https://github.com/dreamhunter2333/cloudflare_temp_email">Star on Github
            </n-button>
        </div>
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
    </n-layout-header>
</template>

<style scoped>
.n-layout-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
</style>
