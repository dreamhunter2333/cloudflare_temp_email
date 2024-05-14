<script setup>
import useClipboard from 'vue-clipboard3'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Copy, User } from '@vicons/fa'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import Login from '../common/Login.vue'

const { toClipboard } = useClipboard()
const message = useMessage()
const router = useRouter()

const {
    jwt, localeCache, settings, showAddressCredential, openSettings
} = useGlobalState()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            yourAddress: 'Your email address is',
            ok: 'OK',
            copy: 'Copy',
            copied: 'Copied',
            fetchAddressError: 'Mail address credential is invalid or account not exist, it may be network connection issue, please try again later.',
            addressCredential: 'Mail Address Credential',
            addressCredentialTip: 'Please copy the Mail Address Credential and you can use it to login to your email account.',
            userLogin: 'User Login',
        },
        zh: {
            yourAddress: '你的邮箱地址是',
            ok: '确定',
            copy: '复制',
            copied: '已复制',
            fetchAddressError: '邮箱地址凭证无效或邮箱地址不存在，也可能是网络连接异常，请稍后再尝试。',
            addressCredential: '邮箱地址凭证',
            addressCredentialTip: '请复制邮箱地址凭证，你可以使用它登录你的邮箱。',
            userLogin: '用户登录',
        }
    }
});

const copy = async () => {
    try {
        await toClipboard(settings.value.address)
        message.success(t('copied'));
    } catch (e) {
        message.error(e.message || "error");
    }
}

onMounted(async () => {
    await api.getSettings();
});
</script>

<template>
    <div>
        <n-card v-if="!settings.fetched">
            <n-skeleton style="height: 50vh" />
        </n-card>
        <div v-else-if="settings.address">
            <n-alert type="info" :show-icon="false">
                <span>
                    <b>{{ t('yourAddress') }} <b>{{ settings.address }}</b></b>
                    <n-button style="margin-left: 10px" @click="copy" size="small" tertiary type="primary">
                        <n-icon :component="Copy" /> {{ t('copy') }}
                    </n-button>
                </span>
            </n-alert>
        </div>
        <div v-else class="center">
            <n-card style="max-width: 600px;">
                <n-alert v-if="jwt" type="warning" :show-icon="false" closable>
                    <span>{{ t('fetchAddressError') }}</span>
                </n-alert>
                <Login />
                <n-divider />
                <n-button @click="router.push('/user')" type="primary" block secondary strong>
                    <template #icon>
                        <n-icon :component="User" />
                    </template>
                    {{ t('userLogin') }}
                </n-button>
            </n-card>
        </div>
        <n-modal v-model:show="showAddressCredential" preset="dialog" :title="t('addressCredential')">
            <span>
                <p>{{ t("addressCredentialTip") }}</p>
            </span>
            <n-card>
                <b>{{ jwt }}</b>
            </n-card>
        </n-modal>
    </div>
</template>

<style scoped>
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
</style>
