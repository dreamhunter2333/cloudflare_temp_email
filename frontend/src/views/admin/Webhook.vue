<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import { api } from '../../api'
// @ts-ignore
const message = useMessage()

const { t } = useScopedI18n('views.admin.Webhook')

class WebhookSettings {
    enableAllowList: boolean;
    allowList: string[];

    constructor(enableAllowList: boolean, allowList: string[]) {
        this.enableAllowList = enableAllowList;
        this.allowList = allowList;
    }
}

const webhookSettings = ref(new WebhookSettings(false, []))
const webhookEnabled = ref(false)
const errorInfo = ref('')

const getSettings = async () => {
    try {
        const res = await api.fetch(`/admin/webhook/settings`)
        Object.assign(webhookSettings.value, res)
        webhookEnabled.value = true
    } catch (error) {
        errorInfo.value = (error as Error).message || "error";
    }
}

const saveSettings = async () => {
    try {
        await api.fetch(`/admin/webhook/settings`, {
            method: 'POST',
            body: JSON.stringify(webhookSettings.value),
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

onMounted(async () => {
    await getSettings();
})
</script>

<template>
    <div class="center">
        <n-card v-if="webhookEnabled" :bordered="false" embedded style="max-width: 800px; overflow: auto;">
            <n-flex justify="end">
                <n-button @click="saveSettings" type="primary">
                    {{ t('save') }}
                </n-button>
            </n-flex>
            <n-form-item-row :label="t('enableAllowList')">
                <n-switch v-model:value="webhookSettings.enableAllowList" :round="false" />
            </n-form-item-row>
            <n-form-item-row :label="t('webhookAllowList')">
                <n-select v-model:value="webhookSettings.allowList" filterable multiple tag
                    :placeholder="t('webhookAllowList')">
                    <template #empty>
                        <n-text depth="3">
                            {{ t('manualInputPrompt') }}
                        </n-text>
                    </template>
                </n-select>
            </n-form-item-row>
        </n-card>
        <n-result v-else status="404" :title="t('notEnabled')" :description="errorInfo" />
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
}
</style>
