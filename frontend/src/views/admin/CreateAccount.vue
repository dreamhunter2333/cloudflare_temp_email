<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useAppI18n as useI18n } from '@/i18n/app'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const {
    loading, openSettings,
} = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            address: 'Address',
            enablePrefix: 'If enable Prefix',
            creatNewEmail: 'Create New Email',
            fillInAllFields: 'Please fill in all fields',
            successTip: 'Success Created',
            addressCredential: 'Mail Address Credential',
            addressCredentialTip: 'Please copy the Mail Address Credential and you can use it to login to your email account.',
            addressPassword: 'Address Password',
            linkWithAddressCredential: 'Open to auto login email link',
            enableRandomSubdomain: 'Use Random Subdomain',
            randomSubdomainTip: 'When enabled, the created address will use a random subdomain. Subdomain addresses are recommended for receiving only.',
        },
        zh: {
            address: '地址',
            enablePrefix: '是否启用前缀',
            creatNewEmail: '创建新邮箱',
            fillInAllFields: '请填写完整信息',
            successTip: '创建成功',
            addressCredential: '邮箱地址凭证',
            addressCredentialTip: '请复制邮箱地址凭证，你可以使用它登录你的邮箱。',
            addressPassword: '地址密码',
            linkWithAddressCredential: '打开即可自动登录邮箱的链接',
            enableRandomSubdomain: '启用随机子域名',
            randomSubdomainTip: '启用后，创建出来的地址会自动挂在随机子域名下。子域名地址更建议仅用于收件。',
        }
    }
});

const enablePrefix = ref(true)
const enableRandomSubdomain = ref(false)
const emailName = ref("")
const emailDomain = ref("")
const showReultModal = ref(false)
const result = ref("")
const addressPassword = ref("")
const createdAddress = ref("")

const canUseRandomSubdomain = computed(() => {
    if (!emailDomain.value) {
        return false
    }
    return (openSettings.value.randomSubdomainDomains || []).includes(emailDomain.value)
})

watch(canUseRandomSubdomain, (enabled) => {
    if (!enabled) {
        enableRandomSubdomain.value = false
    }
})

const newEmail = async () => {
    if (!emailName.value || !emailDomain.value) {
        message.error(t('fillInAllFields'))
        return
    }
    try {
        const res = await api.fetch(`/admin/new_address`, {
            method: 'POST',
            body: JSON.stringify({
                enablePrefix: enablePrefix.value,
                enableRandomSubdomain: enableRandomSubdomain.value,
                name: emailName.value,
                domain: emailDomain.value,
            })
        })
        result.value = res["jwt"];
        addressPassword.value = res["password"] || '';
        createdAddress.value = res["address"] || '';
        message.success(t('successTip'))
        showReultModal.value = true
    } catch (error) {
        message.error(error.message || "error");
    }
}

const getUrlWithJwt = () => {
    return `${window.location.origin}/?jwt=${result.value}`
}

onMounted(async () => {
    if (openSettings.prefix) {
        enablePrefix.value = true
    }
    emailDomain.value = openSettings.value.domains?.[0]?.value || ""
})
</script>

<template>
    <div class="center">
        <n-modal v-model:show="showReultModal" preset="dialog" :title="t('addressCredential')">
            <span>
                <p>{{ t("addressCredentialTip") }}</p>
            </span>
            <n-card embedded>
                <b>{{ result }}</b>
            </n-card>
            <n-card embedded v-if="addressPassword">
                <p><b>{{ createdAddress }}</b></p>
                <p>{{ t('addressPassword') }}: <b>{{ addressPassword }}</b></p>
            </n-card>
            <n-card embedded>
                <n-collapse>
                    <n-collapse-item :title='t("linkWithAddressCredential")'>
                        <n-card embedded>
                            <b>{{ getUrlWithJwt() }}</b>
                        </n-card>
                    </n-collapse-item>
                </n-collapse>
            </n-card>
        </n-modal>
        <n-card :bordered="false" embedded style="max-width: 600px;">
            <n-form-item-row v-if="openSettings.prefix" :label="t('enablePrefix')">
                <n-switch v-model:value="enablePrefix" :round="false" />
            </n-form-item-row>
            <n-form-item-row :label="t('address')">
                <n-input-group>
                    <n-input-group-label v-if="enablePrefix && openSettings.prefix">
                        {{ openSettings.prefix }}
                    </n-input-group-label>
                    <n-input v-model:value="emailName" />
                    <n-input-group-label>@</n-input-group-label>
                    <n-select v-model:value="emailDomain" :consistent-menu-width="false"
                        :options="openSettings.domains" />
                </n-input-group>
            </n-form-item-row>
            <n-form-item-row v-if="canUseRandomSubdomain">
                <n-checkbox v-model:checked="enableRandomSubdomain">
                    {{ t('enableRandomSubdomain') }}
                </n-checkbox>
                <p style="margin: 8px 0 0; opacity: 0.75;">
                    {{ t('randomSubdomainTip') }}
                </p>
            </n-form-item-row>
            <n-button @click="newEmail" type="primary" block :loading="loading">
                {{ t('creatNewEmail') }}
            </n-button>
        </n-card>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
    margin: 20px;
}
</style>
