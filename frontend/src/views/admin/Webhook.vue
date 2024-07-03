<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import { api } from '../../api'
// @ts-ignore
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            successTip: 'Success',
            webhookAllowList: 'Webhook Allow List(Enter the address that is allowed to use webhook)',
            save: 'Save',
        },
        zh: {
            successTip: '成功',
            webhookAllowList: 'Webhook 白名单(请输入允许使用webhook 的地址)',
            save: '保存',
        }
    }
});

class WebhookSettings {
    allowList: string[];

    constructor(allowList: string[]) {
        this.allowList = allowList;
    }
}

const webhookSettings = ref(new WebhookSettings([]))

const getSettings = async () => {
    try {
        const res = await api.fetch(`/admin/webhook/settings`)
        Object.assign(webhookSettings.value, res)
    } catch (error) {
        message.error((error as Error).message || "error");
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
        <n-card :bordered="false" embedded style="max-width: 800px; overflow: auto;">
            <n-form-item-row :label="t('webhookAllowList')">
                <n-select v-model:value="webhookSettings.allowList" filterable multiple tag
                    :placeholder="t('webhookAllowList')" />
            </n-form-item-row>
            <n-button @click="saveSettings" type="primary" block>
                {{ t('save') }}
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
}
</style>
