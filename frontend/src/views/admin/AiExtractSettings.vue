<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
// @ts-ignore
import { api } from '../../api'

const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            title: 'AI Email Extraction Settings',
            successTip: 'Success',
            save: 'Save',
            enableAllowList: 'Enable Address Allowlist',
            enableAllowListTip: 'When enabled, AI extraction will only process emails sent to addresses in the allowlist',
            allowList: 'Address Allowlist (Enter address and press Enter, wildcards supported)',
            allowListTip: "Wildcard * matches any characters, e.g. *{'@'}example.com matches all addresses under example.com domain",
            manualInputPrompt: 'Type and press Enter to add',
            disabledTip: 'When disabled, AI extraction will process all email addresses',
        },
        zh: {
            title: 'AI 邮件提取设置',
            successTip: '成功',
            save: '保存',
            enableAllowList: '启用地址白名单',
            enableAllowListTip: '启用后，AI 提取功能仅对白名单中的邮箱地址生效',
            allowList: '地址白名单 (请输入地址并回车，支持通配符)',
            allowListTip: "通配符 * 可匹配任意字符，如 *{'@'}example.com 可匹配 example.com 域名下的所有地址",
            manualInputPrompt: '输入后按回车键添加',
            disabledTip: '未启用时，所有邮箱地址都可使用 AI 提取功能',
        }
    }
});

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
