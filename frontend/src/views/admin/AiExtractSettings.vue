<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useMessage } from 'naive-ui'
// @ts-ignore
import { api } from '../../api'

const message = useMessage()

const { t } = useScopedI18n('views.admin.AiExtractSettings')

type AiExtractSettings = {
    enableAllowList: boolean
    allowList: string[]
}

const settings = ref<AiExtractSettings>({
    enableAllowList: false,
    allowList: []
})

const fetchData = async () => {
    try {
        const res = await api.fetch(`/admin/ai_extract/settings`) as AiExtractSettings
        Object.assign(settings.value, res)
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const saveSettings = async () => {
    try {
        await api.fetch(`/admin/ai_extract/settings`, {
            method: 'POST',
            body: JSON.stringify(settings.value),
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

onMounted(async () => {
    await fetchData();
})
</script>

<template>
    <div class="center">
        <n-card :title="t('title')" :bordered="false" embedded style="max-width: 800px; overflow: auto;">
            <n-flex justify="end">
                <n-button @click="saveSettings" type="primary">
                    {{ t('save') }}
                </n-button>
            </n-flex>

            <n-form-item-row :label="t('enableAllowList')">
                <n-switch v-model:value="settings.enableAllowList" :round="false" />
            </n-form-item-row>

            <n-alert v-if="!settings.enableAllowList" type="info" style="margin-bottom: 16px;">
                {{ t('disabledTip') }}
            </n-alert>

            <div v-if="settings.enableAllowList">
                <n-alert type="warning" style="margin-bottom: 16px;">
                    {{ t('enableAllowListTip') }}
                </n-alert>

                <n-form-item-row :label="t('allowList')">
                    <n-select v-model:value="settings.allowList" filterable multiple tag
                        :placeholder="t('allowListTip')">
                        <template #empty>
                            <n-text depth="3">
                                {{ t('manualInputPrompt') }}
                            </n-text>
                        </template>
                    </n-select>
                </n-form-item-row>

                <n-text depth="3" style="font-size: 12px;">
                    {{ t('allowListTip') }}
                </n-text>
            </div>
        </n-card>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
}

.n-button {
    margin-top: 10px;
}
</style>
