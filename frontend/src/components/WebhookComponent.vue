<script setup lang="ts">
import { onMounted, ref, h } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import type { DropdownOption } from 'naive-ui'

const props = defineProps({
    fetchData: {
        type: Function,
        default: () => { },
        required: true
    },
    saveSettings: {
        type: Function,
        default: (webhookSettings: WebhookSettings) => { },
        required: true
    },
    testSettings: {
        type: Function,
        default: (webhookSettings: WebhookSettings) => { },
        required: true
    },
})

// @ts-ignore
const message = useMessage()

const { t } = useScopedI18n('components.WebhookComponent')

class WebhookSettings {
    enabled: boolean = false
    url: string = ''
    method: string = 'POST'
    headers: string = JSON.stringify({}, null, 2)
    body: string = JSON.stringify({}, null, 2)
}

interface WebhookPreset {
    name: string
    doc: string
    settings: WebhookSettings
}

const presets: WebhookPreset[] = [
    {
        name: 'Message Pusher',
        doc: 'https://github.com/songquanpeng/message-pusher',
        settings: {
            enabled: true,
            url: 'https://msgpusher.com/push/username',
            method: 'POST',
            headers: JSON.stringify({
                'Content-Type': 'application/json',
            }, null, 2),
            body: JSON.stringify({
                "token": "token",
                "title": "${subject}",
                "description": "${subject}",
                "content": "*${subject}*\n\nFrom: ${from}\nTo: ${to}\n\n${parsedText}\n"
            }, null, 2),
        },
    },
    {
        name: 'Bark',
        doc: 'https://github.com/Finb/Bark',
        settings: {
            enabled: true,
            url: 'https://api.day.app/YOUR_KEY',
            method: 'POST',
            headers: JSON.stringify({
                'Content-Type': 'application/json',
            }, null, 2),
            body: JSON.stringify({
                "title": "${subject}",
                "body": "From: ${from}\nTo: ${to}\n\n${parsedText}",
                "group": "email"
            }, null, 2),
        },
    },
    {
        name: 'ntfy',
        doc: 'https://docs.ntfy.sh/publish/',
        settings: {
            enabled: true,
            url: 'https://ntfy.sh/YOUR_TOPIC',
            method: 'POST',
            headers: JSON.stringify({
                'Content-Type': 'application/json',
            }, null, 2),
            body: JSON.stringify({
                "topic": "YOUR_TOPIC",
                "title": "${subject}",
                "message": "From: ${from}\nTo: ${to}\n\n${parsedText}",
                "tags": ["envelope"]
            }, null, 2),
        },
    },
    {
        name: 'Telegram Bot',
        doc: 'https://core.telegram.org/bots/api#sendmessage',
        settings: {
            enabled: true,
            url: 'https://api.telegram.org/botYOUR_BOT_TOKEN/sendMessage',
            method: 'POST',
            headers: JSON.stringify({
                'Content-Type': 'application/json',
            }, null, 2),
            body: JSON.stringify({
                "chat_id": "YOUR_CHAT_ID",
                "text": "New Email\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
            }, null, 2),
        },
    },
    {
        name: 'WeChat Work',
        doc: 'https://developer.work.weixin.qq.com/document/path/91770',
        settings: {
            enabled: true,
            url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY',
            method: 'POST',
            headers: JSON.stringify({
                'Content-Type': 'application/json',
            }, null, 2),
            body: JSON.stringify({
                "msgtype": "text",
                "text": {
                    "content": "New Email\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
                }
            }, null, 2),
        },
    },
    {
        name: 'Discord',
        doc: 'https://discord.com/developers/docs/resources/webhook',
        settings: {
            enabled: true,
            url: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
            method: 'POST',
            headers: JSON.stringify({
                'Content-Type': 'application/json',
            }, null, 2),
            body: JSON.stringify({
                "content": "**New Email**\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nURL: ${url}"
            }, null, 2),
        },
    },
]

const presetDropdownOptions: DropdownOption[] = presets.map((preset, index) => ({
    label: preset.name,
    key: index,
}))

const handlePresetSelect = (key: number) => {
    const preset = presets[key]
    if (!preset) {
        message.error('Invalid preset')
        return
    }
    Object.assign(webhookSettings.value, preset.settings)
    message.success(t('fillInDemoTip'))
    window.open(preset.doc, '_blank', 'noopener,noreferrer')
}

const webhookSettings = ref<WebhookSettings>(new WebhookSettings())
const enableWebhook = ref(false)
const showTestModal = ref(false)
const testMode = ref('random')
const testMailId = ref<number | null>(null)
const testing = ref(false)

const fetchData = async () => {
    try {
        const res = await props.fetchData()
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
        await props.saveSettings(webhookSettings.value)
        message.success(t('successTip'))
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const testSettings = async () => {
    if (testing.value) return
    if (!webhookSettings.value.url) {
        message.error(t('urlMissing'))
        return
    }
    if (testMode.value === 'specified' && (!Number.isSafeInteger(testMailId.value) || (testMailId.value ?? 0) <= 0)) {
        message.error(t('invalidMailId'))
        return
    }
    testing.value = true
    try {
        await props.testSettings({
            ...webhookSettings.value,
            ...(testMode.value === 'specified' ? { mail_id: testMailId.value } : {}),
        })
        message.success(t('successTip'))
        showTestModal.value = false
    } catch (error) {
        message.error((error as Error).message || "error");
    } finally {
        testing.value = false
    }
}

onMounted(async () => {
    await fetchData();
})
</script>

<template>
    <div class="center">
        <n-card :bordered="false" embedded v-if="enableWebhook" style="max-width: 800px; overflow: auto;">
            <n-flex justify="end">
                <n-dropdown :options="presetDropdownOptions" @select="handlePresetSelect">
                    <n-button secondary>
                        {{ t('presets') }}
                    </n-button>
                </n-dropdown>
                <n-button v-if="webhookSettings.enabled" @click="showTestModal = true" secondary>
                    {{ t('test') }}
                </n-button>
                <n-button @click="saveSettings" type="primary">
                    {{ t('save') }}
                </n-button>
            </n-flex>
            <n-form-item-row :label="t('enable')">
                <n-switch v-model:value="webhookSettings.enabled" :round="false" />
            </n-form-item-row>
            <div v-if="webhookSettings.enabled">
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
            </div>
        </n-card>
        <n-result v-else status="404" :title="t('notEnabled')" />
        <n-modal v-model:show="showTestModal" preset="card" :title="t('test')"
            style="width: min(420px, calc(100vw - 32px))" :mask-closable="!testing"
            :close-on-esc="!testing" :closable="!testing">
            <n-radio-group v-model:value="testMode" :disabled="testing">
                <n-space>
                    <n-radio value="random">{{ t('randomMail') }}</n-radio>
                    <n-radio value="specified">{{ t('specifiedMail') }}</n-radio>
                </n-space>
            </n-radio-group>
            <n-form-item v-if="testMode === 'specified'" :label="t('mailId')" style="margin-top: 16px">
                <n-input-number v-model:value="testMailId" :min="1" :max="Number.MAX_SAFE_INTEGER"
                    :precision="0" :show-button="false" :disabled="testing" :placeholder="t('mailId')"
                    style="width: 100%" />
            </n-form-item>
            <template #footer>
                <n-flex justify="end">
                    <n-button :disabled="testing" @click="showTestModal = false">{{ t('cancel') }}</n-button>
                    <n-button type="primary" :loading="testing" @click="testSettings">{{ t('test') }}</n-button>
                </n-flex>
            </template>
        </n-modal>
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
