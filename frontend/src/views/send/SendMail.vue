<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'
import { useStorage } from '@vueuse/core'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import router from '../../router'

const message = useMessage()
const isPreview = ref(false)

const mailModel = useStorage('mailModelCache', {
    fromName: "",
    toName: "",
    toMail: "",
    subject: "",
    isHtml: false,
    content: "",
})

const { settings } = useGlobalState()

const { t } = useI18n({
    locale: 'zh',
    messages: {
        en: {
            successSend: 'Please check your sendbox. If failed, please check your balance or try again later.',
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
            requestAccessTip: 'You need to request access to send mail, if have request, please contact admin.',
            send_balance: 'Send Mail Balance Left',
        },
        zh: {
            successSend: '请查看您的发件箱, 如果失败, 请检查您的余额或稍后重试。',
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
            requestAccessTip: '您需要申请权限才能发送邮件, 如果已经申请过, 请联系管理员提升额度。',
            send_balance: '剩余发送邮件额度',
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
                        from_name: mailModel.value.fromName,
                        to_name: mailModel.value.toName,
                        to_mail: mailModel.value.toMail,
                        subject: mailModel.value.subject,
                        is_html: mailModel.value.isHtml,
                        content: mailModel.value.content,
                    })
            })
        mailModel.value = {
            fromName: "",
            toName: "",
            toMail: "",
            subject: "",
            isHtml: false,
            content: "",
        }
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        message.success(t("successSend"));
        router.push('/sendbox');
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

onMounted(async () => {
    await api.getSettings();
})
</script>

<template>
    <div class="center" v-if="settings.address">
        <n-card>
            <div v-if="!settings.send_balance || settings.send_balance <= 0">
                <n-alert type="warning" show-icon>
                    {{ t('requestAccessTip') }}
                    <n-button type="primary" ghost @click="requestAccess">{{ t('requestAccess') }}</n-button>
                </n-alert>
                <br />
            </div>
            <div v-else>
                <n-alert type="info" show-icon>
                    {{ t('send_balance') }}: {{ settings.send_balance }}
                </n-alert>
                <div class="right">
                    <n-button type="primary" @click="send">{{ t('send') }}</n-button>
                </div>
                <div class="left">
                    <n-form :model="mailModel">
                        <n-form-item :label="t('fromName')" label-placement="top">
                            <n-input-group>
                                <n-input v-model:value="mailModel.fromName" />
                                <n-input :value="settings.address" disabled />
                            </n-input-group>
                        </n-form-item>
                        <n-form-item :label="t('toName')" label-placement="top">
                            <n-input-group>
                                <n-input v-model:value="mailModel.toName" />
                                <n-input v-model:value="mailModel.toMail" />
                            </n-input-group>
                        </n-form-item>
                        <n-form-item :label="t('subject')" label-placement="top">
                            <n-input v-model:value="mailModel.subject" />
                        </n-form-item>
                        <n-form-item :label="t('options')" label-placement="top">
                            <n-checkbox v-model:checked="mailModel.isHtml">
                                {{ t('isHtml') }}
                            </n-checkbox>
                            <n-button v-if="mailModel.isHtml" @click="isPreview = !isPreview">
                                {{ isPreview ? t('edit') : t('preview') }}
                            </n-button>
                        </n-form-item>
                        <n-form-item :label="t('content')" label-placement="top">
                            <div v-if="isPreview" v-html="mailModel.content" />
                            <n-input v-else type="textarea" v-model:value="mailModel.content" :autosize="{
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
