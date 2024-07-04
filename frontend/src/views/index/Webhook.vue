<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import { api } from '../../api'

const { settings } = useGlobalState()
// @ts-ignore
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            successTip: 'Success',
            test: 'Test',
            save: 'Save',
            notEnabled: 'Webhook is not enabled for you',
            urlMissing: 'URL is required',
        },
        zh: {
            successTip: '成功',
            test: '测试',
            save: '保存',
            notEnabled: 'Webhook 未开启，请联系管理员开启',
            urlMissing: 'URL 不能为空',
        }
    }
});

class WebhookSettings {
    url: string = ''
    method: string = 'POST'
    headers: string = JSON.stringify({}, null, 2)
    body: string = JSON.stringify({}, null, 2)
}

const webhookSettings = ref<WebhookSettings>(new WebhookSettings())
const enableWebhook = ref(false)

const fetchData = async () => {
    try {
        const res = await api.fetch(`/api/webhook/settings`)
        Object.assign(webhookSettings.value, res)
        enableWebhook.value = true
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const saveSettings = async () => {
    if (!webhookSettings.value.url) {
        message.error(t('urlMissing'))
        return
    }
    try {
        await api.fetch(`/api/webhook/settings`, {
            method: 'POST',
            body: JSON.stringify(webhookSettings.value),
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const testSettings = async () => {
    if (!webhookSettings.value.url) {
        message.error(t('urlMissing'))
        return
    }
    try {
        await api.fetch(`/api/webhook/test`, {
            method: 'POST',
            body: JSON.stringify(webhookSettings.value),
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
    <div class="center" v-if="settings.address">
        <n-card :bordered="false" embedded v-if="enableWebhook" style="max-width: 800px; overflow: auto;">
            <n-form-item-row label="URL">
                <n-input v-model:value="webhookSettings.url" />
            </n-form-item-row>
            <n-form-item-row label="METHOD">
                <n-select v-model:value="webhookSettings.method" tag :options='[
                    { label: "POST", value: "POST" }
                ]' />
            </n-form-item-row>
            <n-form-item-row label="HEADERS">
                <n-input v-model:value="webhookSettings.headers" type="textarea" :autosize="{ minRows: 3 }" />
            </n-form-item-row>
            <n-form-item-row label="BODY">
                <n-input v-model:value="webhookSettings.body" type="textarea" :autosize="{ minRows: 3 }" />
            </n-form-item-row>
            <n-button @click="testSettings" secondary block strong>
                {{ t('test') }}
            </n-button>
            <n-button @click="saveSettings" type="primary" block>
                {{ t('save') }}
            </n-button>
        </n-card>
        <n-result v-else status="404" :title="t('notEnabled')" />
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
