<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'

import { useGlobalState } from '../../store'
import { api } from '../../api'

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

const fetchData = async () => {
    try {
        const res = await api.fetch("/api/auto_reply")
        sourcePrefix.value = res.source_prefix || ""
        enableAutoReply.value = res.enabled || false
        name.value = res.name || ""
        autoReplyMessage.value = res.message || ""
        subject.value = res.subject || ""
    } catch (error) {
        message.error(error.message || "error");
    }
}

const saveData = async () => {
    try {
        await api.fetch("/api/auto_reply", {
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
    await fetchData()
})
</script>

<template>
    <div class="center">
        <n-card :bordered="false" embedded v-if="settings.address" :title='t("settings")'>
            <div class="right">
                <n-button type="primary" @click="saveData">{{ t('save') }}</n-button>
            </div>
            <div class="left">
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
            </div>
        </n-card>
    </div>
</template>

<style scoped>
.n-card {
    max-width: 800px;
}

.n-button {
    text-align: left;
}

.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
}

.left {
    text-align: left;
    place-items: left;
    justify-content: left;
}

.right {
    text-align: right;
    place-items: right;
    justify-content: right;
}
</style>
