<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { getRouterPathWithLang } from '../../utils'

const {
    jwt, settings, showAddressCredential, loading, openSettings
} = useGlobalState()
const router = useRouter()
const message = useMessage()

const showLogout = ref(false)
const showDeleteAccount = ref(false)
const showClearInbox = ref(false)
const showClearSentItems = ref(false)
const { locale, t } = useI18n({
    messages: {
        en: {
            logout: "Logout",
            deleteAccount: "Delete Account",
            showAddressCredential: 'Show Address Credential',
            logoutConfirm: 'Are you sure to logout?',
            deleteAccount: "Delete Account",
            deleteAccountConfirm: "Are you sure to delete your account and all emails for this account?",
            clearInbox: "Clear Inbox",
            clearSentItems: "Clear Sent Items",
            clearInboxConfirm: "Are you sure to clear all emails in your inbox?",
            clearSentItemsConfirm: "Are you sure to clear all emails in your sent items?",
            success: "Success",
        },
        zh: {
            logout: '退出登录',
            deleteAccount: "删除账户",
            showAddressCredential: '查看邮箱地址凭证',
            logoutConfirm: '确定要退出登录吗？',
            deleteAccount: "删除账户",
            deleteAccountConfirm: "确定要删除你的账户和其中的所有邮件吗?",
            clearInbox: "清空收件箱",
            clearSentItems: "清空发件箱",
            clearInboxConfirm: "确定要清空你收件箱中的所有邮件吗？",
            clearSentItemsConfirm: "确定要清空你发件箱中的所有邮件吗？",
            success: "成功",
        }
    }
});

const logout = async () => {
    jwt.value = '';
    await router.push(getRouterPathWithLang("/", locale.value))
    location.reload()
}

const deleteAccount = async () => {
    try {
        await api.fetch(`/api/delete_address`, {
            method: 'DELETE'
        });
        jwt.value = '';
        await router.push(getRouterPathWithLang("/", locale.value))
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
};

const clearInbox = async () => {
    try {
        await api.fetch(`/api/clear_inbox`, {
            method: 'DELETE'
        });
        message.success(t("success"));
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        showClearInbox.value = false;
    }
};

const clearSentItems = async () => {
    try {
        await api.fetch(`/api/clear_sent_items`, {
            method: 'DELETE'
        });
        message.success(t("success"));
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        showClearSentItems.value = false;
    }
};
</script>

<template>
    <div class="center" v-if="settings.address">
        <n-card :bordered="false" embedded>
            <n-button @click="showAddressCredential = true" type="primary" secondary block strong>
                {{ t('showAddressCredential') }}
            </n-button>
            <n-button v-if="openSettings.enableUserDeleteEmail" @click="showClearInbox = true" type="warning" secondary
                block strong>
                {{ t('clearInbox') }}
            </n-button>
            <n-button v-if="openSettings.enableUserDeleteEmail" @click="showClearSentItems = true" type="warning"
                secondary block strong>
                {{ t('clearSentItems') }}
            </n-button>
            <n-button @click="showLogout = true" secondary block strong>
                {{ t('logout') }}
            </n-button>
            <n-button v-if="openSettings.enableUserDeleteEmail" @click="showDeleteAccount = true" type="error" secondary
                block strong>
                {{ t('deleteAccount') }}
            </n-button>
        </n-card>
        <n-modal v-model:show="showLogout" preset="dialog" :title="t('logout')">
            <p>{{ t('logoutConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="logout" size="small" tertiary type="warning">
                    {{ t('logout') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showDeleteAccount" preset="dialog" :title="t('deleteAccount')">
            <p>{{ t('deleteAccountConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="deleteAccount" size="small" tertiary type="error">
                    {{ t('deleteAccount') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showClearInbox" preset="dialog" :title="t('clearInbox')">
            <p>{{ t('clearInboxConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="clearInbox" size="small" tertiary type="warning">
                    {{ t('clearInbox') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showClearSentItems" preset="dialog" :title="t('clearSentItems')">
            <p>{{ t('clearSentItemsConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="clearSentItems" size="small" tertiary type="warning">
                    {{ t('clearSentItems') }}
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
