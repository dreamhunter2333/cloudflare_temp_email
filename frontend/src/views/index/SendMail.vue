<script setup>
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { useI18n } from 'vue-i18n'
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import AdminContact from '../common/AdminContact.vue'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const message = useMessage()
const isPreview = ref(false)
const editorRef = shallowRef()


const { settings, sendMailModel, indexTab } = useGlobalState()

const { t } = useI18n({
    locale: 'zh',
    messages: {
        en: {
            successSend: 'Please check your sendbox. If failed, please check your balance or try again later.',
            fromName: 'Your Name and Address, leave Name blank to use email address',
            toName: 'Recipient Name and Address, leave Name blank to use email address',
            subject: 'Subject',
            options: 'Options',
            edit: 'Edit',
            preview: 'Preview',
            content: 'Content',
            send: 'Send',
            requestAccess: 'Request Access',
            requestAccessTip: 'You need to request access to send mail, if have request, please contact admin.',
            send_balance: 'Send Mail Balance Left',
            text: 'Text',
            html: 'HTML',
            'rich text': 'Rich Text',
            tooLarge: 'Too large file, please upload file less than 1MB.',
        },
        zh: {
            successSend: '请查看您的发件箱, 如果失败, 请检查您的余额或稍后重试。',
            fromName: '你的名称和地址，名称不填写则使用邮箱地址',
            toName: '收件人名称和地址，名称不填写则使用邮箱地址',
            subject: '主题',
            options: '选项',
            edit: '编辑',
            preview: '预览',
            content: '内容',
            send: '发送',
            requestAccess: '申请权限',
            requestAccessTip: '您需要申请权限才能发送邮件, 如果已经申请过, 请联系管理员提升额度。',
            send_balance: '剩余发送邮件额度',
            text: '文本',
            html: 'HTML',
            'rich text': '富文本',
            tooLarge: '文件过大, 请上传小于1MB的文件。',
        }
    }
});

const contentTypes = [
    { label: t('text'), value: 'text' },
    { label: t('html'), value: 'html' },
    { label: t('rich text'), value: 'rich' },
]

const send = async () => {
    try {
        await api.fetch(`/api/send_mail`,
            {
                method: 'POST',
                body:
                    JSON.stringify({
                        from_name: sendMailModel.value.fromName,
                        to_name: sendMailModel.value.toName,
                        to_mail: sendMailModel.value.toMail,
                        subject: sendMailModel.value.subject,
                        is_html: sendMailModel.value.contentType != 'text',
                        content: sendMailModel.value.content,
                    })
            })
        sendMailModel.value = {
            fromName: "",
            toName: "",
            toMail: "",
            subject: "",
            contentType: 'text',
            content: "",
        }
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        message.success(t("successSend"));
        indexTab.value = 'sendbox'
    }
}

const requestAccess = async () => {
    try {
        await api.fetch(`/api/requset_send_mail_access`,
            {
                method: 'POST',
                body: JSON.stringify({})
            }
        )
        message.success(t("success"))
        await api.getSettings();
    } catch (error) {
        message.error(error.message || "error");
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

onMounted(async () => {
    await api.getSettings();
})
</script>

<template>
    <div class="center" v-if="settings.address">
        <n-card :bordered="false" embedded>
            <div v-if="!settings.send_balance || settings.send_balance <= 0">
                <n-alert type="warning" :show-icon="false" :bordered="false">
                    {{ t('requestAccessTip') }}
                    <n-button type="primary" tertiary @click="requestAccess" size="small">{{ t('requestAccess')
                        }}</n-button>
                </n-alert>
                <br />
                <AdminContact />
            </div>
            <div v-else>
                <n-alert type="info" :show-icon="false" :bordered="false">
                    {{ t('send_balance') }}: {{ settings.send_balance }}
                </n-alert>
                <div class="right">
                    <n-button type="primary" @click="send">{{ t('send') }}</n-button>
                </div>
                <div class="left">
                    <n-form :model="sendMailModel">
                        <n-form-item :label="t('fromName')" label-placement="top">
                            <n-input-group>
                                <n-input v-model:value="sendMailModel.fromName" />
                                <n-input :value="settings.address" disabled />
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

.right {
    text-align: right;
    place-items: right;
    justify-content: right;
}
</style>
