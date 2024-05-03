<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const {
    jwt, localeCache, settings, showPassword, mailboxSplitSize, useIframeShowMail
} = useGlobalState()
const router = useRouter()
const message = useMessage()

const showLogout = ref(false)
const showDelteAccount = ref(false)
const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            mailboxSplitSize: 'Mailbox Split Size',
            useIframeShowMail: 'Use iframe Show Mail',
            logout: "Logout",
            delteAccount: "Delete Account",
            showPassword: 'Show Password',
            logoutConfirm: 'Are you sure to logout?',
            delteAccount: "Delete Account",
            delteAccountConfirm: "Are you sure to delete your account and all emails for this account?",
        },
        zh: {
            mailboxSplitSize: '邮箱界面分栏大小',
            useIframeShowMail: '使用iframe显示邮件',
            logout: '退出登录',
            delteAccount: "删除账户",
            showPassword: '查看密码',
            logoutConfirm: '确定要退出登录吗？',
            delteAccount: "删除账户",
            delteAccountConfirm: "确定要删除你的账户和其中的所有邮件吗?",
        }
    }
});

const logout = async () => {
    jwt.value = '';
    await router.push('/')
    location.reload()
}

const deleteAccount = async () => {
    try {
        await api.fetch(`/api/delete_address`, {
            method: 'DELETE'
        });
        jwt.value = '';
        await router.push('/')
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
};
</script>

<template>
    <div class="center" v-if="settings.address">
        <n-card>
            <n-card>
                <n-form-item-row :label="t('mailboxSplitSize')">
                    <n-slider v-model:value="mailboxSplitSize" :min="0.25" :max="0.75" :step="0.01" :marks="{
                        0.25: '0.25',
                        0.5: '0.5',
                        0.75: '0.75'
                    }" />
                </n-form-item-row>
                <n-form-item-row :label="t('useIframeShowMail')">
                    <n-switch v-model:value="useIframeShowMail" :round="false" />
                </n-form-item-row>
            </n-card>
            <n-button @click="showPassword = true" type="primary" secondary block strong>
                {{ t('showPassword') }}
            </n-button>
            <n-button @click="showLogout = true" secondary block strong>
                {{ t('logout') }}
            </n-button>
            <n-button @click="showDelteAccount = true" type="error" secondary block strong>
                {{ t('delteAccount') }}
            </n-button>
        </n-card>
        <n-modal v-model:show="showLogout" preset="dialog" :title="t('logout')">
            <p>{{ t('logoutConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="logout" size="small" tertiary type="primary">
                    {{ t('logout') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showDelteAccount" preset="dialog" :title="t('delteAccount')">
            <p>{{ t('delteAccountConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="deleteAccount" size="small" tertiary type="error">
                    {{ t('delteAccount') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    justify-content: center;
}


.n-card {
    max-width: 800px;
    text-align: left;
}

.n-button {
    margin-top: 10px;
}
</style>
