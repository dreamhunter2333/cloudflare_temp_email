<script setup>
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'

import { useGlobalState } from '../store'
import { api } from '../api'

const message = useMessage()
const isPreview = ref(false)

const fromName = ref("")
const toName = ref("")
const toMail = ref("")
const subject = ref("")
const isHtml = ref(false)
const content = ref("")

const { settings } = useGlobalState()

const { t } = useI18n({
    locale: 'zh',
    messages: {
        en: {
            successSend: 'Success Sended',
            fromName: 'Your Name and Address, leave Name blank to use email address',
            toName: 'Recipient Name and Address, leave Name blank to use email address',
            subject: 'Subject',
            options: 'Options',
            isHtml: 'Enable HTML',
            edit: 'Edit',
            preview: 'Preview',
            content: 'Content',
            send: 'Send',
            requestAccess: 'Request Access',
            requestAccessTip: 'You need to request access to send mail',
        },
        zh: {
            successSend: '成功发送',
            fromName: '你的名称和地址，名称不填写则使用邮箱地址',
            toName: '收件人名称和地址，名称不填写则使用邮箱地址',
            subject: '主题',
            options: '选项',
            isHtml: '启用HTML',
            edit: '编辑',
            preview: '预览',
            content: '内容',
            send: '发送',
            requestAccess: '申请权限',
            requestAccessTip: '您需要申请权限才能发送邮件',
        }
    }
});

const send = async () => {
    try {
        await api.fetch(`/api/send_mail`,
            {
                method: 'POST',
                body:
                    JSON.stringify({
                        from_name: fromName.value,
                        to_name: toName.value,
                        to_mail: toMail.value,
                        subject: subject.value,
                        is_html: isHtml.value,
                        content: content.value,
                    })
            })
        message.success(t("successSend"))
    } catch (error) {
        message.error(error.message || "error");
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
    } catch (error) {
        message.error(error.message || "error");
    }
}
</script>

<template>
    <div class="center" v-if="settings.address">
        <n-card>
            <div v-if="!settings.has_send_access">
                <n-alert type="warning" show-icon>
                    {{ t('requestAccessTip') }}
                    <n-button type="primary" ghost @click="requestAccess">{{ t('requestAccess') }}</n-button>
                </n-alert>
                <br />
            </div>
            <div v-else>
                <div class="right">
                    <n-button type="primary" @click="send">{{ t('send') }}</n-button>
                </div>
                <div class="left">
                    <n-form-item :label="t('fromName')" label-placement="top">
                        <n-input-group>
                            <n-input v-model:value="fromName" />
                            <n-input :value="settings.address" disabled />
                        </n-input-group>
                    </n-form-item>
                    <n-form-item :label="t('toName')" label-placement="top">
                        <n-input-group>
                            <n-input v-model:value="toName" />
                            <n-input v-model:value="toMail" />
                        </n-input-group>
                    </n-form-item>
                    <n-form-item :label="t('subject')" label-placement="top">
                        <n-input v-model:value="subject" />
                    </n-form-item>
                    <n-form-item :label="t('options')" label-placement="top">
                        <n-checkbox v-model:checked="isHtml">
                            {{ t('isHtml') }}
                        </n-checkbox>
                        <n-button v-if="isHtml" @click="isPreview = !isPreview">
                            {{ isPreview ? t('edit') : t('preview') }}
                        </n-button>
                    </n-form-item>
                    <n-form-item :label="t('content')" label-placement="top">
                        <div v-if="isPreview" v-html="content" />
                        <n-input v-else type="textarea" v-model:value="content" :autosize="{
                            minRows: 3
                        }" />
                    </n-form-item>
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
