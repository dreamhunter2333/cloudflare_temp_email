<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            save: 'Save',
            successTip: 'Save Success',
            enable: 'Enable',
            enableUserRegister: 'Allow User Register',
            enableMailVerify: 'Enable Mail Verify (Send address must be an address in the system with a balance and can send mail normally)',
            verifyMailSender: 'Verify Mail Sender',
            enableMailAllowList: 'Enable Mail Address Allow List(Manually enterable)',
            manualInputPrompt: 'Type and press Enter to add',
            mailAllowList: 'Mail Address Allow List',
            maxAddressCount: 'Maximum number of email addresses that can be binded',
        },
        zh: {
            save: '保存',
            successTip: '保存成功',
            enable: '启用',
            enableUserRegister: "允许用户注册",
            enableMailVerify: '启用邮件验证(发送地址必须是系统中能有余额且能正常发送邮件的地址)',
            verifyMailSender: '验证邮件发送地址',
            enableMailAllowList: '启用邮件地址白名单(可手动输入, 回车增加)',
            manualInputPrompt: '输入后按回车键添加',
            mailAllowList: '邮件地址白名单',
            maxAddressCount: '可绑定最大邮箱地址数量',
        }
    }
});

const commonMail = [
    "gmail.com", "163.com", "126.com", "qq.com", "outlook.com", "hotmail.com",
    "icloud.com", "yahoo.com", "foxmail.com"
]

const mailAllowOptions = commonMail.map((item) => {
    return { label: item, value: item }
})

const userSettings = ref({
    enable: false,
    enableMailVerify: false,
    verifyMailSender: "",
    enableMailAllowList: false,
    mailAllowList: commonMail,
    maxAddressCount: 5,
});

const fetchData = async () => {
    try {
        const res = await api.fetch(`/admin/user_settings`)
        Object.assign(userSettings.value, res)
    } catch (error) {
        message.error(error.message || "error");
    }
}

const save = async () => {
    try {
        await api.fetch(`/admin/user_settings`, {
            method: 'POST',
            body: JSON.stringify(userSettings.value)
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error(error.message || "error");
    }
}


onMounted(async () => {
    await fetchData();
})
</script>

<template>
    <div class="center">
        <n-card :bordered="false" embedded style="max-width: 600px;">
            <n-flex justify="end">
                <n-button @click="save" type="primary" :loading="loading">
                    {{ t('save') }}
                </n-button>
            </n-flex>
            <n-form :model="userSettings">
                <n-form-item-row :label="t('enableUserRegister')">
                    <n-switch v-model:value="userSettings.enable" :round="false" />
                </n-form-item-row>
                <n-form-item-row :label="t('enableMailVerify')">
                    <n-input-group>
                        <n-checkbox v-model:checked="userSettings.enableMailVerify" style="width: 20%;">
                            {{ t('enable') }}
                        </n-checkbox>
                        <n-input v-model:value="userSettings.verifyMailSender" v-if="userSettings.enableMailVerify"
                            style="width: 80%;" :placeholder="t('verifyMailSender')" />
                    </n-input-group>
                </n-form-item-row>
                <n-form-item-row :label="t('enableMailAllowList')">
                    <n-input-group>
                        <n-checkbox v-model:checked="userSettings.enableMailAllowList" style="width: 20%;">
                            {{ t('enable') }}
                        </n-checkbox>
                        <n-select v-model:value="userSettings.mailAllowList" v-if="userSettings.enableMailAllowList"
                            filterable multiple tag style="width: 80%;" :options="mailAllowOptions"
                            :placeholder="t('mailAllowList')">
                            <template #empty>
                                <n-text depth="3">
                                    {{ t('manualInputPrompt') }}
                                </n-text>
                            </template>
                        </n-select>
                    </n-input-group>
                </n-form-item-row>
                <n-form-item-row :label="t('maxAddressCount')">
                    <n-input-group>
                        <n-input-number v-model:value="userSettings.maxAddressCount"
                            :placeholder="t('maxAddressCount')" />
                    </n-input-group>
                </n-form-item-row>
            </n-form>
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
