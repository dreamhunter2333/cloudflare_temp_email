<script setup>
import useClipboard from 'vue-clipboard3'
import { ref, h, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useIsMobile } from '../utils/composables'
import { DarkModeFilled, LightModeFilled, MenuFilled, AdminPanelSettingsFilled } from '@vicons/material'
import { GithubAlt, Language, User, Home, Copy } from '@vicons/fa'

import { useGlobalState } from '../store'
import { api } from '../api'
const { toClipboard } = useClipboard()
const message = useMessage()

const { jwt, localeCache, themeSwitch, showAuth, adminAuth, auth } = useGlobalState()
const { showLogin, openSettings, settings } = useGlobalState()
const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()
const isAdminRoute = computed(() => route.path.includes('admin'))

const showNewEmail = ref(false)
const showLogout = ref(false)
const showDelteAccount = ref(false)
const password = ref('')
const showPassword = ref(false)
const emailName = ref("")
const emailDomain = ref("")

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
            delteAccount: "Delete Account",
            delteAccountConfirm: "Are you sure to delete your account and all emails for this account?",
            auth: 'Auth',
            authTip: 'Please enter the correct auth code',
            settings: 'Settings',
            home: 'Home',
            menu: 'Menu',
            user: 'User',
            pleaseGetNewEmail: 'Please login or click "Get New Email" button to get a new email address',
            getNewEmail: 'Get New Email',
            getNewEmailTip1: 'Please input the email you want to use.',
            getNewEmailTip2: 'Levaing it blank will generate a random email address.',
            yourAddress: 'Your email address is',
            password: 'Password',
            passwordTip: 'Please copy the password and you can use it to login to your email account.', cancel: 'Cancel',
            ok: 'OK',
            copy: 'Copy',
            copied: 'Copied',
            showPassword: 'Show Password',
            fetchAddressError: 'Fetch address error, maybe your jwt is invalid or network error.',
        },
        zh: {
            title: 'Cloudflare 临时邮件',
            dark: '暗色',
            light: '亮色',
            login: '登录',
            logout: '登出',
            logoutConfirm: '确定要登出吗？',
            delteAccount: "删除账户",
            delteAccountConfirm: "确定要删除你的账户和其中的所有邮件吗?",
            auth: '授权',
            authTip: '请输入正确的授权码',
            settings: '设置',
            home: '主页',
            menu: '菜单',
            user: '用户',
            pleaseGetNewEmail: '请"登录"或点击 "获取新邮箱" 按钮来获取一个新的邮箱地址',
            getNewEmail: '获取新邮箱',
            getNewEmailTip1: '请输入你想要使用的邮箱地址。',
            getNewEmailTip2: '留空将会生成一个随机的邮箱地址。',
            yourAddress: '你的邮箱地址是',
            password: '密码',
            passwordTip: '请复制密码，你可以使用它登录你的邮箱。',
            cancel: '取消',
            ok: '确定',
            copy: '复制',
            copied: '已复制',
            showPassword: '查看密码',
            fetchAddressError: '获取地址失败, 请检查你的 jwt 是否有效 或 网络是否正常。',
        }
    }
});

const showUserMenu = computed(() => !!settings.value.address)

const menuOptions = computed(() => [
    {
        label: () => h(
            NButton,
            {
                bordered: false,
                ghost: true,
                size: "small",
                onClick: () => router.push('/')
            },
            {
                default: () => t('home'),
                icon: () => h(NIcon, { component: Home })
            }
        ),
        key: "home"
    },
    {
        label: () => h(
            NButton,
            {
                bordered: false,
                ghost: true,
                size: "small",
                onClick: () => router.push('/admin')
            },
            {
                default: () => "Admin",
                icon: () => h(NIcon, { component: AdminPanelSettingsFilled }),
            }
        ),
        show: !!adminAuth.value,
        key: "admin"
    },
    {
        label: () => h(
            NButton,
            {
                bordered: false,
                ghost: true,
                size: "small",
            },
            {
                default: () => t('user'),
                icon: () => h(NIcon, { component: User }),
            }
        ),
        show: showUserMenu.value,
        key: "user",
        children: [
            {
                label: () => h(
                    NButton,
                    {
                        tertiary: true,
                        ghost: true,
                        size: "small",
                        onClick: () => { showPassword.value = true }
                    },
                    { default: () => t('showPassword') }
                ),
                key: "showPassword"
            },
            {
                label: () => h(
                    NButton,
                    {
                        tertiary: true,
                        ghost: true,
                        size: "small",
                        onClick: () => { router.push('/settings') }
                    },
                    { default: () => t('settings') }
                ),
                key: "settings"
            },
            {
                label: () => h(
                    NButton,
                    {
                        tertiary: true,
                        ghost: true,
                        size: "small",
                        onClick: () => { showLogout.value = true }
                    },
                    { default: () => t('logout') }
                ),
                key: "logout"
            },
            {
                label: () => h(
                    NButton,
                    {
                        tertiary: true,
                        ghost: true,
                        size: "small",
                        onClick: () => { showDelteAccount.value = true }
                    },
                    { default: () => t('delteAccount') }
                ),
                key: "delte_account"
            }
        ]
    },
    {
        label: () => h(
            NButton,
            {
                bordered: false,
                ghost: true,
                size: "small",
                onClick: () => { themeSwitch.value = !themeSwitch.value }
            },
            {
                default: () => themeSwitch.value ? t('light') : t('dark'),
                icon: () => h(
                    NIcon, { component: themeSwitch.value ? LightModeFilled : DarkModeFilled }
                )
            }
        ),
        key: "theme"
    },
    {
        label: () => h(
            NButton,
            {
                bordered: false,
                ghost: true,
                size: "small",
                onClick: () => localeCache.value == 'zh' ? changeLocale('en') : changeLocale('zh')
            },
            {
                default: () => localeCache.value == 'zh' ? "English" : "中文",
                icon: () => h(
                    NIcon, { component: Language }
                )
            }
        ),
        key: "lang"
    },
    {
        label: () => h(
            NButton,
            {
                bordered: !isMobile.value,
                ghost: true,
                size: "small",
                tag: "a",
                target: "_blank",
                href: "https://github.com/dreamhunter2333/cloudflare_temp_email",
            },
            {
                default: () => "Github",
                icon: () => h(NIcon, { component: GithubAlt })
            }
        ),
        key: "github"
    }
]);

const menuOptionsMobile = computed(() => [
    {
        label: t('menu'),
        icon: () => h(
            NIcon,
            {
                component: MenuFilled
            }
        ),
        key: "menu",
        children: menuOptions.value
    },
]);


const copy = async () => {
    try {
        await toClipboard(settings.value.address)
        message.success(t('copied'));
    } catch (e) {
        message.error(e.message || "error");
    }
}

const newEmail = async () => {
    try {
        const res = await api.fetch(
            `/api/new_address`
            + `?name=${emailName.value || ''}`
            + `&domain=${emailDomain.value || ''}`
        );
        jwt.value = res["jwt"];
        await api.getSettings();
        showNewEmail.value = false;
        showPassword.value = true;
    } catch (error) {
        message.error(error.message || "error");
    }
};

const deleteAccount = async () => {
    try {
        await api.fetch(`/api/delete_address`, {
            method: 'DELETE'
        });
        jwt.value = '';
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
};

onMounted(async () => {
    await api.getOpenSettings(message);
    emailDomain.value = openSettings.value.domains ? openSettings.value.domains[0].value : "";
});
</script>

<template>
    <div>
        <n-layout-header>
            <h2 style="display: inline-block; margin-left: 10px;">{{ t('title') }}</h2>
            <div>
                <n-menu v-if="!isMobile" mode="horizontal" :options="menuOptions" />
                <n-menu v-else mode="horizontal" :options="menuOptionsMobile" />
            </div>
        </n-layout-header>
        <div v-if="!isAdminRoute">
            <n-card v-if="!settings.fetched">
                <n-skeleton style="height: 50vh" />
            </n-card>
            <n-alert v-else-if="settings.address" type="info" show-icon>
                <span>
                    <b>{{ t('yourAddress') }} <b>{{ settings.address }}</b></b>
                    <n-button style="margin-left: 10px" @click="copy" size="small" tertiary round type="primary">
                        <n-icon :component="Copy" /> {{ t('copy') }}
                    </n-button>
                </span>
            </n-alert>
            <n-card v-else>
                <n-result status="info" :description="t('pleaseGetNewEmail')">
                    <template #footer>
                        <n-alert v-if="jwt" type="warning" show-icon>
                            <span>{{ t('fetchAddressError') }}</span>
                        </n-alert>
                        <n-button @click="showLogin = true" tertiary round type="primary">
                            {{ t('login') }}
                        </n-button>
                        <n-button @click="showNewEmail = true" tertiary round type="primary">
                            {{ t('getNewEmail') }}
                        </n-button>
                    </template>
                </n-result>
            </n-card>
        </div>
        <n-modal v-model:show="showNewEmail" preset="dialog" title="Dialog">
            <template #header>
                <div>{{ t('getNewEmail') }}</div>
            </template>
            <span>
                <p>{{ t("getNewEmailTip1") }}</p>
                <p>{{ t("getNewEmailTip2") }}</p>
            </span>
            <n-input-group>
                <n-input-group-label v-if="openSettings.prefix">
                    {{ openSettings.prefix }}
                </n-input-group-label>
                <n-input v-model:value="emailName" />
                <n-input-group-label>@</n-input-group-label>
                <n-select v-model:value="emailDomain" :consistent-menu-width="false" :options="openSettings.domains" />
            </n-input-group>
            <template #action>
                <n-button @click="showNewEmail = false">
                    {{ t('cancel') }}
                </n-button>
                <n-button @click="newEmail" type="primary">
                    {{ t('ok') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showPassword" preset="dialog" title="Dialog">
            <template #header>
                <div>{{ t("password") }}</div>
            </template>
            <span>
                <p>{{ t("passwordTip") }}</p>
            </span>
            <n-card>
                <b>{{ jwt }}</b>
            </n-card>
            <template #action>
            </template>
        </n-modal>
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
        <n-modal v-model:show="showLogout" preset="dialog" title="Dialog">
            <template #header>
                <div>{{ t('logout') }}</div>
            </template>
            <p>{{ t('logoutConfirm') }}</p>
            <template #action>
                <n-button @click="logout" size="small" tertiary round type="primary">
                    {{ t('logout') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showDelteAccount" preset="dialog" title="Dialog">
            <template #header>
                <div>{{ t('delteAccount') }}</div>
            </template>
            <p>{{ t('delteAccountConfirm') }}</p>
            <template #action>
                <n-button @click="deleteAccount" size="small" tertiary round type="error">
                    {{ t('delteAccount') }}
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

.n-alert {
    margin-top: 10px;
    margin-bottom: 10px;
    text-align: center;
}

.n-card {
    margin-top: 10px;
}
</style>
