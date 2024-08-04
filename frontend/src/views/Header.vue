<script setup>
import { ref, h, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useIsMobile } from '../utils/composables'
import {
    DarkModeFilled, LightModeFilled, MenuFilled,
    AdminPanelSettingsFilled
} from '@vicons/material'
import { GithubAlt, Language, User, Home } from '@vicons/fa'

import { useGlobalState } from '../store'
import { api } from '../api'
import { getRouterPathWithLang } from '../utils'

const message = useMessage()

const {
    toggleDark, isDark, isTelegram, showAdminPage,
    showAuth, auth, loading, openSettings
} = useGlobalState()
const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()

const showMobileMenu = ref(false)
const menuValue = computed(() => {
    if (route.path.includes("user")) return "user";
    if (route.path.includes("admin")) return "admin";
    return "home";
});

const authFunc = async () => {
    try {
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
}

const changeLocale = async (lang) => {
    if (lang == 'zh') {
        await router.push(route.fullPath.replace('/en', ''));
    } else {
        await router.push(`/${lang}${route.fullPath}`);
    }
}

const { locale, t } = useI18n({
    messages: {
        en: {
            title: 'Cloudflare Temp Email',
            dark: 'Dark',
            light: 'Light',
            accessHeader: 'Access Password',
            accessTip: 'Please enter the correct access password',
            home: 'Home',
            menu: 'Menu',
            user: 'User',
            ok: 'OK',
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
            ok: '确定',
        }
    }
});

const version = import.meta.env.PACKAGE_VERSION ? `v${import.meta.env.PACKAGE_VERSION}` : "";

const menuOptions = computed(() => [
    {
        label: () => h(NButton,
            {
                text: true,
                size: "small",
                type: menuValue.value == "home" ? "primary" : "default",
                style: "width: 100%",
                onClick: async () => {
                    await router.push(getRouterPathWithLang('/', locale.value));
                    showMobileMenu.value = false;
                }
            },
            {
                default: () => t('home'),
                icon: () => h(NIcon, { component: Home })
            }),
        key: "home"
    },
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                type: menuValue.value == "user" ? "primary" : "default",
                style: "width: 100%",
                onClick: async () => {
                    await router.push(getRouterPathWithLang("/user", locale.value));
                    showMobileMenu.value = false;
                }
            },
            {
                default: () => t('user'),
                icon: () => h(NIcon, { component: User }),
            }
        ),
        key: "user",
        show: !isTelegram.value
    },
    {
        label: () => h(
            NButton,
            {
                text: true,
                size: "small",
                type: menuValue.value == "admin" ? "primary" : "default",
                style: "width: 100%",
                onClick: async () => {
                    await router.push(getRouterPathWithLang('/admin', locale.value));
                    showMobileMenu.value = false;
                }
            },
            {
                default: () => "Admin",
                icon: () => h(NIcon, { component: AdminPanelSettingsFilled }),
            }
        ),
        show: showAdminPage.value,
        key: "admin"
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
                onClick: async () => {
                    locale.value == 'zh' ? await changeLocale('en') : await changeLocale('zh');
                    showMobileMenu.value = false;
                }
            },
            {
                default: () => locale.value == 'zh' ? "English" : "中文",
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
                default: () => version || "Github",
                icon: () => h(NIcon, { component: GithubAlt })
            }
        ),
        show: openSettings.value?.showGithub,
        key: "github"
    }
]);

useHead({
    title: () => openSettings.value.title || t('title'),
    meta: [
        { name: "description", content: openSettings.value.description || t('title') },
    ]
});

const logoClickCount = ref(0);
const logoClick = async () => {
    if (route.path.includes("admin")) {
        logoClickCount.value = 0;
        return;
    }
    if (logoClickCount.value >= 5) {
        logoClickCount.value = 0;
        message.info("Change to admin Page");
        await router.push(getRouterPathWithLang('/admin', locale.value));
    } else {
        logoClickCount.value++;
    }
    if (logoClickCount.value > 0) {
        message.info(`Click ${5 - logoClickCount.value + 1} times to enter the admin page`);
    }
}

onMounted(async () => {
    await api.getOpenSettings(message);
    try {
        await api.getUserSettings(message);
    } catch (error) {
        console.error(error);
    }
});
</script>

<template>
    <div>
        <n-page-header>
            <template #title>
                <h3>{{ openSettings.title || t('title') }}</h3>
            </template>
            <template #avatar>
                <div @click="logoClick">
                    <n-avatar style="margin-left: 10px;" src="/logo.png" />
                </div>
            </template>
            <template #extra>
                <n-space>
                    <n-menu v-if="!isMobile" mode="horizontal" :options="menuOptions" responsive />
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
