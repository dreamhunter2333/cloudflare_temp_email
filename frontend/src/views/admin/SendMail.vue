<script setup>
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { useScopedI18n } from '@/i18n/app'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useSessionStorage } from '@vueuse/core'
import { SendRound } from '@vicons/material'
import { api } from '../../api'
import ShadowHtmlComponent from '../../components/ShadowHtmlComponent.vue'
import { useGlobalState } from '../../store'
import { blockRemoteContent } from '../../utils/remote-content-policy'
import { sanitizeHtml } from '../../utils/sanitize-html'

const message = useMessage()
const isPreview = ref(false)
const editorRef = shallowRef()
const sending = ref(false)
const { autoLoadRemoteImages, isDark } = useGlobalState()

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

const contentTypes = computed(() => [
    { label: t('text'), value: 'text' },
    { label: t('html'), value: 'html' },
    { label: t('rich text'), value: 'rich' },
])

const previewContent = computed(() => {
    const content = `${sendMailModel.value.content ?? ''}`
    return autoLoadRemoteImages.value
        ? sanitizeHtml(content)
        : blockRemoteContent(content).html
})

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
        isPreview.value = false
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
    <div class="composer-page">
        <n-card class="composer-card" :bordered="false" embedded>
            <template #header>
                <div class="composer-title">
                    <h2>{{ t('composeMail') }}</h2>
                    <n-text depth="3">{{ t('adminComposeTip') }}</n-text>
                </div>
            </template>

            <n-form class="composer-form" :model="sendMailModel" label-placement="top">
                <n-grid cols="1 m:2" responsive="screen" :x-gap="16">
                    <n-grid-item>
                        <n-form-item :label="t('senderAddress')" required
                            :label-props="{ for: 'admin-send-mail-sender-address' }">
                            <n-input v-model:value="sendMailModel.fromMail"
                                :input-props="{ id: 'admin-send-mail-sender-address' }" />
                        </n-form-item>
                    </n-grid-item>
                    <n-grid-item>
                        <n-form-item :label="t('senderName')"
                            :label-props="{ for: 'admin-send-mail-sender-name' }">
                            <n-input v-model:value="sendMailModel.fromName"
                                :input-props="{ id: 'admin-send-mail-sender-name' }" />
                        </n-form-item>
                    </n-grid-item>
                    <n-grid-item>
                        <n-form-item :label="t('recipientAddress')" required
                            :label-props="{ for: 'admin-send-mail-recipient-address' }">
                            <n-input v-model:value="sendMailModel.toMail"
                                :input-props="{ id: 'admin-send-mail-recipient-address' }" />
                        </n-form-item>
                    </n-grid-item>
                    <n-grid-item>
                        <n-form-item :label="t('recipientName')"
                            :label-props="{ for: 'admin-send-mail-recipient-name' }">
                            <n-input v-model:value="sendMailModel.toName"
                                :input-props="{ id: 'admin-send-mail-recipient-name' }" />
                        </n-form-item>
                    </n-grid-item>
                </n-grid>

                <n-form-item :label="t('subject')" required
                    :label-props="{ for: 'admin-send-mail-subject' }">
                    <n-input v-model:value="sendMailModel.subject"
                        :input-props="{ id: 'admin-send-mail-subject' }" />
                </n-form-item>

                <div class="editor-panel">
                    <div class="editor-panel-header">
                        <n-text id="admin-send-mail-content-label" strong>{{ t('content') }} <span
                                class="required-mark">*</span></n-text>
                        <div class="editor-controls">
                            <n-radio-group class="format-options" v-model:value="sendMailModel.contentType"
                                size="small" aria-labelledby="admin-send-mail-content-label">
                                <n-radio-button v-for="option in contentTypes" :key="option.value"
                                    :value="option.value" :label="option.label" />
                            </n-radio-group>
                            <n-button v-if="sendMailModel.contentType !== 'text'" tertiary size="small"
                                @click="isPreview = !isPreview">
                                {{ isPreview ? t('edit') : t('preview') }}
                            </n-button>
                        </div>
                    </div>

                    <div v-if="isPreview && sendMailModel.contentType !== 'text'" class="compose-preview">
                        <ShadowHtmlComponent :htmlContent="previewContent" :isDark="isDark" />
                    </div>
                    <div v-else-if="sendMailModel.contentType === 'rich'" class="rich-editor">
                        <Toolbar :defaultConfig="toolbarConfig" :editor="editorRef" mode="default" />
                        <Editor v-model="sendMailModel.content" :defaultConfig="editorConfig" mode="default"
                            @onCreated="handleCreated" />
                    </div>
                    <n-input v-else class="compose-textarea" type="textarea" :bordered="false"
                        v-model:value="sendMailModel.content" :placeholder="t('contentPlaceholder')"
                        :input-props="{ 'aria-label': t('content') }"
                        :autosize="{ minRows: 14, maxRows: 24 }" />
                </div>

                <div class="composer-actions">
                    <n-text depth="3" class="draft-status">{{ t('draftSaved') }}</n-text>
                    <n-button type="primary" :loading="sending" :disabled="sending" @click="send">
                        <template #icon><n-icon :component="SendRound" /></template>
                        {{ t('send') }}
                    </n-button>
                </div>
            </n-form>
        </n-card>
    </div>
</template>

<style scoped>
.composer-page {
    width: 100%;
    padding: 14px 0 24px;
    text-align: left;
}

.composer-card {
    width: min(900px, 100%);
    margin: 0 auto;
}

.composer-title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px 12px;
}

.composer-title > h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}

.composer-title .n-text {
    font-size: 13px;
}

.editor-panel {
    overflow: hidden;
    border: 1px solid rgba(128, 128, 128, 0.24);
    border-radius: 3px;
}

.editor-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 46px;
    padding: 6px 10px 6px 14px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.18);
}

.editor-controls {
    display: flex;
    align-items: center;
    gap: 8px;
}

.required-mark {
    color: #d03050;
}

.format-options {
    display: flex;
}

.format-options :deep(.n-radio-button) {
    min-width: 72px;
    text-align: center;
}

.compose-preview {
    min-height: 360px;
    padding: 18px;
}

.rich-editor {
    background: #fff;
}

.rich-editor :deep(.w-e-toolbar) {
    border-bottom: 1px solid #e5e7eb;
}

.rich-editor :deep(.w-e-text-container),
.rich-editor :deep(.w-e-scroll) {
    min-height: 360px;
}

.compose-textarea :deep(.n-input__textarea-el),
.compose-textarea :deep(.n-input__placeholder) {
    line-height: 1.7;
    text-align: left;
}

.composer-form :deep(.n-input__input-el) {
    text-align: left;
}

.composer-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(128, 128, 128, 0.18);
}

.draft-status {
    font-size: 13px;
}

@media (max-width: 640px) {
    .composer-page {
        padding-top: 8px;
    }

    .editor-panel-header {
        align-items: flex-start;
        flex-wrap: wrap;
    }

    .editor-controls {
        width: 100%;
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    .format-options {
        max-width: 100%;
    }

    .format-options :deep(.n-radio-button) {
        min-width: 0;
        padding-right: 8px;
        padding-left: 8px;
    }

    .rich-editor :deep(.w-e-toolbar) {
        overflow-x: auto;
    }
}
</style>
