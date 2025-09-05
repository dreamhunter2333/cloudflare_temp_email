<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n'

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
            creatNewEmail: 'Get New Email',
            fillInAllFields: 'Please fill in all fields',
            successTip: 'Success Created',
            addressCredential: 'Mail Address Credential',
        },
        zh: {
            address: '地址',
            enablePrefix: '是否启用前缀',
            creatNewEmail: '创建新邮箱',
            fillInAllFields: '请填写完整信息',
            successTip: '创建成功',
            addressCredential: '邮箱地址凭证',
        }
    }
});

const enablePrefix = ref(true)
const emailName = ref("")
const emailDomain = ref("")
const showReultModal = ref(false)
const result = ref("")

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
                name: emailName.value,
                domain: emailDomain.value,
            })
        })
        result.value = res["jwt"];
        message.success(t('successTip'))
        showReultModal.value = true
    } catch (error) {
        message.error(error.message || "error");
    }
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
            <p>{{ t('addressCredential') }}</p>
            <n-card :bordered="false" embedded>
                <b>{{ result }}</b>
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
