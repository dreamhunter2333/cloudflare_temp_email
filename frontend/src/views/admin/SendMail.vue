<script setup>
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { useScopedI18n } from '@/i18n/app'
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { useSessionStorage } from '@vueuse/core'
import { api } from '../../api'

const message = useMessage()
const isPreview = ref(false)
const editorRef = shallowRef()
const sending = ref(false)

const sendMailModel = useSessionStorage('sendMailByAdminModel', {
    fromName: "",
    fromMail: "",
    toName: "",
    toMail: "",
    subject: "",
    contentType: 'text',
    content: "",
});

const { t } = useScopedI18n('views.admin.SendMail')

const contentTypes = [
    { label: t('text'), value: 'text' },
    { label: t('html'), value: 'html' },
    { label: t('rich text'), value: 'rich' },
]

const normalizeSendMailText = (content) => {
    return content
        .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

const hasSendMailContent = (content, contentType) => {
    if (typeof content !== 'string' || !content) {
        return false
    }

    if (contentType === 'text') {
        return normalizeSendMailText(content).length > 0
    }

    const container = document.createElement('div')
    container.innerHTML = content
    container.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove())

    const plainContent = normalizeSendMailText(container.textContent ?? '')
    if (plainContent.length > 0) {
        return true
    }

    return Boolean(container.querySelector('img, audio, video, iframe, svg, canvas, table'))
}

const send = async () => {
    if (sending.value) {
        return
    }

    const fromMail = `${sendMailModel.value.fromMail ?? ''}`.trim()
    const toMail = `${sendMailModel.value.toMail ?? ''}`.trim()
    const subject = `${sendMailModel.value.subject ?? ''}`.trim()
    const content = `${sendMailModel.value.content ?? ''}`

    if (!fromMail) {
        message.error(t('fromMailEmpty'))
        return
    }
    if (!subject) {
        message.error(t('subjectEmpty'))
        return
    }
    if (!toMail) {
        message.error(t('toMailEmpty'))
        return
    }
    if (!hasSendMailContent(content, sendMailModel.value.contentType)) {
        message.error(t('contentEmpty'))
        return
    }

    const payload = {
        from_name: sendMailModel.value.fromName,
        from_mail: fromMail,
        to_name: sendMailModel.value.toName,
        to_mail: toMail,
        subject,
        is_html: sendMailModel.value.contentType != 'text',
        content,
    }

    sending.value = true
    try {
        await api.fetch(`/admin/send_mail`,
            {
                method: 'POST',
                body: JSON.stringify(payload)
            })
        sendMailModel.value = {
            fromName: "",
            fromMail: "",
            toName: "",
            toMail: "",
            subject: "",
            contentType: 'text',
            content: "",
        }
        message.success(t("successSend"));
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        sending.value = false
    }
}

const toolbarConfig = {
    excludeKeys: ["uploadVideo"]
}

const editorConfig = {
    MENU_CONF: {
        'uploadImage': {
            async customUpload() {
                message.error(t('tooLarge'))
            },
            maxFileSize: 1 * 1024 * 1024,
            base64LimitSize: 1 * 1024 * 1024,
        }
    }
}

onBeforeUnmount(() => {
    const editor = editorRef.value
    if (editor == null) return
    editor.destroy()
})

const handleCreated = (editor) => {
    editorRef.value = editor;
}
</script>

<template>
    <div class="center">
        <n-card :bordered="false" embedded>
            <n-flex justify="end">
                <n-button type="primary" :loading="sending" :disabled="sending" @click="send">{{ t('send') }}</n-button>
            </n-flex>
            <div class="left">
                <n-form :model="sendMailModel">
                    <n-form-item :label="t('fromName')" label-placement="top">
                        <n-input-group>
                            <n-input v-model:value="sendMailModel.fromName" />
                            <n-input v-model:value="sendMailModel.fromMail" />
                        </n-input-group>
                    </n-form-item>
                    <n-form-item :label="t('toName')" label-placement="top">
                        <n-input-group>
                            <n-input v-model:value="sendMailModel.toName" />
                            <n-input v-model:value="sendMailModel.toMail" />
                        </n-input-group>
                    </n-form-item>
                    <n-form-item :label="t('subject')" label-placement="top">
                        <n-input v-model:value="sendMailModel.subject" />
                    </n-form-item>
                    <n-form-item :label="t('options')" label-placement="top">
                        <n-radio-group v-model:value="sendMailModel.contentType">
                            <n-radio-button v-for="option in contentTypes" :key="option.value" :value="option.value"
                                :label="option.label" />
                        </n-radio-group>
                        <n-button v-if="sendMailModel.contentType != 'text'" @click="isPreview = !isPreview"
                            style="margin-left: 10px;">
                            {{ isPreview ? t('edit') : t('preview') }}
                        </n-button>
                    </n-form-item>
                    <n-form-item :label="t('content')" label-placement="top">
                        <n-card :bordered="false" embedded v-if="isPreview">
                            <div v-html="sendMailModel.content" />
                        </n-card>
                        <div v-else-if="sendMailModel.contentType == 'rich'" style="border: 1px solid #ccc">
                            <Toolbar style="border-bottom: 1px solid #ccc" :defaultConfig="toolbarConfig"
                                :editor="editorRef" mode="default" />
                            <Editor style="height: 500px; overflow-y: hidden;" v-model="sendMailModel.content"
                                :defaultConfig="editorConfig" mode="default" @onCreated="handleCreated" />
                        </div>
                        <n-input v-else type="textarea" v-model:value="sendMailModel.content" :autosize="{
                            minRows: 3
                        }" />
                    </n-form-item>
                </n-form>
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
    margin-right: 10px;
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
</style>
