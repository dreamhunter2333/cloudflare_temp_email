<script setup>
import useClipboard from 'vue-clipboard3'
import { ref, h, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useIsMobile } from '../utils/composables'
import {
    DarkModeFilled, LightModeFilled, MenuFilled,
    AdminPanelSettingsFilled, SendFilled
} from '@vicons/material'
import { GithubAlt, Language, User, Home, Copy } from '@vicons/fa'

import Login from './Login.vue'

import { useGlobalState } from '../store'
import { api } from '../api'
const { toClipboard } = useClipboard()
const message = useMessage()

const {
    jwt, localeCache, toggleDark, isDark, settings, showPassword,
    showAuth, adminAuth, auth, loading
} = useGlobalState()
const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()
const isAdminRoute = computed(() => route.path.includes('admin'))

const showMobileMenu = ref(false)

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
            accessHeader: 'Access Password',
            accessTip: 'Please enter the correct password',
            home: 'Home',
            menu: 'Menu',
            user: 'User',
            sendMail: 'Send Mail',
            yourAddress: 'Your email address is',
            ok: 'OK',
            copy: 'Copy',
            copied: 'Copied',
            fetchAddressError: 'Login password is invalid or account not exist, it may be network connection issue, please try again later.',
            mailV1Alert: 'You have some mails in v1, please click here to login and visit your history mails.',
            password: 'Password',
            passwordTip: 'Please copy the password and you can use it to login to your email account.',
        },
        zh: {
            title: 'Cloudflare 临时邮件',
            dark: '暗色',
            light: '亮色',
            accessHeader: '访问密码',
            accessTip: '请输入站点访问密码',
            home: '主页',
            menu: '菜单',
            user: '用户',
            sendMail: '发送邮件',
            yourAddress: '你的邮箱地址是',
            ok: '确定',
            copy: '复制',
            copied: '已复制',
            fetchAddressError: '登录密码无效或账号不存在，也可能是网络连接异常，请稍后再尝试。',
            mailV1Alert: '你有一些 v1 版本的邮件，请点击此处登录查看。',
            password: '密码',
            passwordTip: '请复制密码，你可以使用它登录你的邮箱。',
        }
    }
});

const showUserMenu = computed(() => !!settings.value.address)

const menuOptions = computed(() => [
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                style: "width: 100%",
                onClick: () => { router.push('/'); showMobileMenu.value = false; }
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
                text: true,
                size: "small",
                style: "width: 100%",
                onClick: () => { router.push('/admin'); showMobileMenu.value = false; }
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
                text: true,
                size: "small",
                style: "width: 100%",
                onClick: () => { router.push("/user"); showMobileMenu.value = false; }
            },
            {
                default: () => t('user'),
                icon: () => h(NIcon, { component: User }),
            }
        ),
        show: showUserMenu.value,
        key: "user",
    },
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                style: "width: 100%",
                onClick: () => { toggleDark(); showMobileMenu.value = false; }
            },
            {
                default: () => isDark.value ? t('light') : t('dark'),
                icon: () => h(
                    NIcon, { component: isDark.value ? LightModeFilled : DarkModeFilled }
                )
            }
        ),
        key: "theme"
    },
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                style: "width: 100%",
                onClick: () => {
                    localeCache.value == 'zh' ? changeLocale('en') : changeLocale('zh');
                    showMobileMenu.value = false;
                }
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
                text: true,
                size: "small",
                style: "width: 100%",
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

const copy = async () => {
    try {
        await toClipboard(settings.value.address)
        message.success(t('copied'));
    } catch (e) {
        message.error(e.message || "error");
    }
}

onMounted(async () => {
    await api.getOpenSettings(message);
    await api.getSettings();
});
</script>

<template>
    <div>
        <n-page-header>
            <template #title>
                <h3>{{ t('title') }}</h3>
            </template>
            <template #avatar>
                <n-avatar style="margin-left: 10px;" src="/logo.png" />
            </template>
            <template #extra>
                <n-space>
                    <n-menu v-if="!isMobile" mode="horizontal" :options="menuOptions" />
                    <n-button v-else :text="true" @click="showMobileMenu = !showMobileMenu" style="margin-right: 10px;">
                        <template #icon>
                            <n-icon :component="MenuFilled" />
                        </template>
                        {{ t('menu') }}
                    </n-button>
                </n-space>
            </template>
        </n-page-header>
        <n-drawer v-model:show="showMobileMenu" placement="top" style="height: 100vh;">
            <n-drawer-content :title="t('menu')" closable>
                <n-menu :options="menuOptions" />
            </n-drawer-content>
        </n-drawer>
        <div v-if="!isAdminRoute">
            <n-card v-if="!settings.fetched">
                <n-skeleton style="height: 50vh" />
            </n-card>
            <div v-else-if="settings.address">
                <n-alert v-if="settings.has_v1_mails" type="warning" show-icon closable>
                    <span>
                        <n-button tag="a" target="_blank" tertiary type="info" size="small"
                            href="https://mail-v1.awsl.uk">
                            <b>{{ t('mailV1Alert') }} </b>
                        </n-button>
                    </span>
                </n-alert>
                <n-alert type="info" show-icon>
                    <span>
                        <b>{{ t('yourAddress') }} <b>{{ settings.address }}</b></b>
                        <n-button style="margin-left: 10px" @click="router.push('/send')" size="small" tertiary
                            type="primary">
                            <n-icon :component="SendFilled" /> {{ t('sendMail') }}
                        </n-button>
                        <n-button style="margin-left: 10px" @click="copy" size="small" tertiary type="primary">
                            <n-icon :component="Copy" /> {{ t('copy') }}
                        </n-button>
                    </span>
                </n-alert>
            </div>
            <div v-else class="center">
                <n-card style="max-width: 600px;">
                    <n-alert v-if="jwt" type="warning" show-icon>
                        <span>{{ t('fetchAddressError') }}</span>
                    </n-alert>
                    <Login />
                </n-card>
            </div>
        </div>
        <n-modal v-model:show="showPassword" preset="dialog" :title="t('password')">
            <span>
                <p>{{ t("passwordTip") }}</p>
            </span>
            <n-card>
                <b>{{ jwt }}</b>
            </n-card>
        </n-modal>
        <n-modal v-model:show="showAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
            :title="t('accessHeader')">
            <p>{{ t('accessTip') }}</p>
            <n-input v-model:value="auth" type="textarea" :autosize="{ minRows: 3 }" />
            <template #action>
                <n-button :loading="loading" @click="authFunc" type="primary">
                    {{ t('ok') }}
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

.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
    margin: 20px;
}

.n-form .n-button {
    margin-top: 10px;
}
</style>
