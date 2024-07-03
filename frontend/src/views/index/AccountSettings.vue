<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import Appearance from '../common/Appearance.vue'
import { getRouterPathWithLang } from '../../utils'

const {
    jwt, settings, showAddressCredential, loading
} = useGlobalState()
const router = useRouter()
const message = useMessage()

const showLogout = ref(false)
const showDelteAccount = ref(false)
const { locale, t } = useI18n({
    messages: {
        en: {
            logout: "Logout",
            delteAccount: "Delete Account",
            showAddressCredential: 'Show Address Credential',
            logoutConfirm: 'Are you sure to logout?',
            delteAccount: "Delete Account",
            delteAccountConfirm: "Are you sure to delete your account and all emails for this account?",
        },
        zh: {
            logout: '退出登录',
            delteAccount: "删除账户",
            showAddressCredential: '查看邮箱地址凭证',
            logoutConfirm: '确定要退出登录吗？',
            delteAccount: "删除账户",
            delteAccountConfirm: "确定要删除你的账户和其中的所有邮件吗?",
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
</script>

<template>
    <div class="center" v-if="settings.address">
        <n-card :bordered="false" embedded>
            <Appearance />
            <n-button @click="showAddressCredential = true" type="primary" secondary block strong>
                {{ t('showAddressCredential') }}
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
