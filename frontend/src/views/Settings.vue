<script setup>
import { NSpace, NFormItem, NInput, NSwitch, NButton } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'

import Header from './Header.vue'
import { useGlobalState } from '../store'
import { api } from '../api'

const message = useMessage()
const sourcePrefix = ref("")
const enableAutoReply = ref(false)
const autoReplyMessage = ref("")
const subject = ref("")
const name = ref("")

const { settings } = useGlobalState()


const { t } = useI18n({
    locale: 'zh',
    messages: {
        en: {
            success: 'Success',
            settings: 'Settings',
            sourcePrefix: 'Source Mail Prefix',
            name: 'Name',
            enableAutoReply: 'Enable Auto Reply',
            subject: 'Subject',
            autoReply: 'Auto Reply',
            save: 'Save',
        },
        zh: {
            success: '成功',
            settings: '设置',
            sourcePrefix: '来源邮件前缀',
            name: '名称',
            enableAutoReply: '启用自动回复',
            subject: '主题',
            autoReply: '自动回复',
            save: '保存',
        }
    }
});

const getSettings = async () => {
    await api.getSettings()
    sourcePrefix.value = settings.value.auto_reply.source_prefix || ""
    enableAutoReply.value = settings.value.auto_reply.enabled || false
    name.value = settings.value.auto_reply.name || ""
    autoReplyMessage.value = settings.value.auto_reply.message || ""
    subject.value = settings.value.auto_reply.subject || ""
}

const saveSettings = async () => {
    try {
        await api.fetch("/api/settings", {
            method: "POST",
            body: JSON.stringify({
                auto_reply: {
                    enabled: enableAutoReply.value,
                    source_prefix: sourcePrefix.value,
                    name: name.value,
                    message: autoReplyMessage.value,
                    subject: subject.value,
                }
            })
        })
        message.success(t("success"))
    } catch (error) {
        message.error(error.message || "error");
    }
}

onMounted(async () => {
    await getSettings()
})
</script>

<template>
    <n-space v-if="settings.address" vertical>
        <Header />
        <h1>{{ t("settings") }}</h1>
        <n-button type="primary" @click="saveSettings">{{ t('save') }}</n-button>
        <n-form-item :label="t('enableAutoReply')" label-placement="left">
            <n-switch v-model:value="enableAutoReply" />
        </n-form-item>
        <n-form-item :label="t('name')" label-placement="left">
            <n-input :disabled="!enableAutoReply" v-model:value="name" />
        </n-form-item>
        <n-form-item :label="t('sourcePrefix')" label-placement="left">
            <n-input :disabled="!enableAutoReply" v-model:value="sourcePrefix" />
        </n-form-item>
        <n-form-item :label="t('subject')" label-placement="left">
            <n-input :disabled="!enableAutoReply" v-model:value="subject" />
        </n-form-item>
        <n-form-item :label="t('autoReply')" label-placement="left">
            <n-input :disabled="!enableAutoReply" type="textarea" v-model:value="autoReplyMessage" />
        </n-form-item>
    </n-space>
</template>
