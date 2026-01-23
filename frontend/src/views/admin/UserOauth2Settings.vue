<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import { api } from '../../api'
import constant from '../../constant'
import { UserOauth2Settings } from '../../models';

const { loading } = useGlobalState()
// @ts-ignore
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            save: 'Save',
            delete: 'Delete',
            successTip: 'Save Success',
            enable: 'Enable',
            enableMailAllowList: 'Enable Mail Address Allow List(Manually enterable)',
            manualInputPrompt: 'Type and press Enter to add',
            mailAllowList: 'Mail Address Allow List',
            addOauth2: 'Add Oauth2',
            name: 'Name',
            oauth2Type: 'Oauth2 Type',
            enableEmailFormat: 'Enable Email Format',
            userEmailFormat: 'Email Regex Pattern',
            userEmailReplace: 'Replace Template',
            userEmailFormatTip: 'Use regex to transform email. Example: ^(.+)@old\\.com$ with $1@new.com',
            tip: 'Third-party login will automatically use the user\'s email to register an account (the same email will be regarded as the same account), this account is the same as the registered account, and you can also set the password through the forget password',
        },
        zh: {
            save: '保存',
            delete: '删除',
            successTip: '保存成功',
            enable: '启用',
            enableMailAllowList: '启用邮件地址白名单(可手动输入, 回车增加)',
            manualInputPrompt: '输入后按回车键添加',
            mailAllowList: '邮件地址白名单',
            addOauth2: '添加 Oauth2',
            name: '名称',
            oauth2Type: 'Oauth2 类型',
            enableEmailFormat: '启用邮箱格式转换',
            userEmailFormat: '邮箱正则表达式',
            userEmailReplace: '替换模板',
            userEmailFormatTip: '使用正则转换邮箱。示例: ^(.+)@old\\.com$ 配合 $1@new.com',
            tip: '第三方登录会自动使用用户邮箱注册账号(邮箱相同将视为同一账号), 此账号和注册的账号相同, 也可以通过忘记密码设置密码',
        }
    }
});

const mailAllowOptions = constant.COMMOM_MAIL.map((item) => {
    return { label: item, value: item }
})

const userOauth2Settings = ref([] as UserOauth2Settings[])
const showAddOauth2 = ref(false)
const newOauth2Name = ref('')
const newOauth2Type = ref('custom')

const fetchData = async () => {
    try {
        const res = await api.fetch(`/admin/user_oauth2_settings`)
        Object.assign(userOauth2Settings.value, res)
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const save = async () => {
    try {
        await api.fetch(`/admin/user_oauth2_settings`, {
            method: 'POST',
            body: JSON.stringify(userOauth2Settings.value)
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const addNewOauth2 = () => {
    const templates: Record<string, Partial<UserOauth2Settings>> = {
        github: {
            authorizationURL: 'https://github.com/login/oauth/authorize',
            accessTokenURL: 'https://github.com/login/oauth/access_token',
            accessTokenFormat: 'json',
            userInfoURL: 'https://api.github.com/user',
            userEmailKey: 'email',
            scope: 'user:email',
        },
        linuxdo: {
            authorizationURL: 'https://connect.linux.do/oauth2/authorize',
            accessTokenURL: 'https://connect.linux.do/oauth2/token',
            accessTokenFormat: 'urlencoded',
            userInfoURL: 'https://connect.linux.do/api/user',
            userEmailKey: 'id',
            scope: 'user',
            enableEmailFormat: true,
            userEmailFormat: '^(.+)$',
            userEmailReplace: 'linux_do_$1@oauth.linux.do',
        },
        authentik: {
            authorizationURL: 'https://youdomain/application/o/authorize/',
            accessTokenURL: 'https://youdomain/application/o/token/',
            accessTokenFormat: 'urlencoded',
            userInfoURL: 'https://youdomain/application/o/userinfo/',
            userEmailKey: 'email',
            scope: 'email openid',
        },
        custom: {},
    }
    const template = templates[newOauth2Type.value] || {}
    userOauth2Settings.value.push({
        name: newOauth2Name.value,
        clientID: '',
        clientSecret: '',
        authorizationURL: '',
        accessTokenURL: '',
        accessTokenFormat: '',
        userInfoURL: '',
        userEmailKey: '',
        redirectURL: `${window.location.origin}/user/oauth2/callback`,
        logoutURL: '',
        scope: '',
        enableEmailFormat: false,
        userEmailFormat: '',
        userEmailReplace: '',
        enableMailAllowList: false,
        mailAllowList: constant.COMMOM_MAIL,
        ...template,
    } as UserOauth2Settings)
    newOauth2Name.value = ''
    showAddOauth2.value = false
}

const accessTokenFormatOptions = [
    { label: 'json', value: 'json' },
    { label: 'urlencoded', value: 'urlencoded' },
]

onMounted(async () => {
    await fetchData();
})
</script>

<template>
    <div class="center">
        <n-modal v-model:show="showAddOauth2" preset="dialog" :title="t('addOauth2')">
            <n-form>
                <n-form-item-row :label="t('name')" required>
                    <n-input v-model:value="newOauth2Name" />
                </n-form-item-row>
                <n-form-item-row :label="t('oauth2Type')" required>
                    <n-radio-group v-model:value="newOauth2Type">
                        <n-radio-button value="github" label="Github" />
                        <n-radio-button value="linuxdo" label="Linux Do" />
                        <n-radio-button value="authentik" label="Authentik" />
                        <n-radio-button value="custom" label="Custom" />
                    </n-radio-group>
                </n-form-item-row>
            </n-form>
            <template #action>
                <n-button :loading="loading" @click="addNewOauth2" size="small" tertiary type="primary">
                    {{ t('addOauth2') }}
                </n-button>
            </template>
        </n-modal>
        <n-card :bordered="false" embedded style="max-width: 600px;">
            <n-alert :show-icon="false" :bordered="false" type="warning" closable style="margin-bottom: 10px;">
                {{ t("tip") }}
            </n-alert>
            <n-flex justify="end">
                <n-button @click="showAddOauth2 = true" secondary :loading="loading">
                    {{ t('addOauth2') }}
                </n-button>
                <n-button @click="save" type="primary" :loading="loading">
                    {{ t('save') }}
                </n-button>
            </n-flex>
            <n-divider />
            <n-collapse default-expanded-names="1" accordion :trigger-areas="['main', 'arrow']">
                <n-collapse-item v-for="(item, index) in userOauth2Settings" :key="index" :title="item.name">
                    <template #header-extra>
                        <n-popconfirm @positive-click="userOauth2Settings.splice(index, 1)">
                            <template #trigger>
                                <n-button tertiary type="error">
                                    {{ t('delete') }}
                                </n-button>
                            </template>
                            {{ t('delete') }}
                        </n-popconfirm>
                    </template>
                    <n-form :model="item">
                        <n-form-item-row :label="t('name')" required>
                            <n-input v-model:value="item.name" />
                        </n-form-item-row>
                        <n-form-item-row label="Client ID" required>
                            <n-input v-model:value="item.clientID" />
                        </n-form-item-row>
                        <n-form-item-row label="Client Secret" required>
                            <n-input v-model:value="item.clientSecret" />
                        </n-form-item-row>
                        <n-form-item-row label="Authorization URL" required>
                            <n-input v-model:value="item.authorizationURL" />
                        </n-form-item-row>
                        <n-form-item-row label="Access Token URL" required>
                            <n-input v-model:value="item.accessTokenURL" />
                        </n-form-item-row>
                        <n-form-item-row label="Access Token Params Format" required>
                            <n-select v-model:value="item.accessTokenFormat" :options="accessTokenFormatOptions" />
                        </n-form-item-row>
                        <n-form-item-row label="User Info URL" required>
                            <n-input v-model:value="item.userInfoURL" />
                        </n-form-item-row>
                        <n-form-item-row label="User Email Key (Support JSONPATH like $[0].email)" required>
                            <n-input v-model:value="item.userEmailKey" />
                        </n-form-item-row>
                        <n-form-item-row :label="t('enableEmailFormat')">
                            <n-checkbox v-model:checked="item.enableEmailFormat">
                                {{ t('enable') }}
                            </n-checkbox>
                        </n-form-item-row>
                        <n-form-item-row v-if="item.enableEmailFormat" :label="t('userEmailFormat')">
                            <n-tooltip trigger="hover">
                                <template #trigger>
                                    <n-input v-model:value="item.userEmailFormat" :placeholder="'^(.+)@old\\.com$'" />
                                </template>
                                {{ t('userEmailFormatTip') }}
                            </n-tooltip>
                        </n-form-item-row>
                        <n-form-item-row v-if="item.enableEmailFormat" :label="t('userEmailReplace')">
                            <n-tooltip trigger="hover">
                                <template #trigger>
                                    <n-input v-model:value="item.userEmailReplace" placeholder="$1@new.com" />
                                </template>
                                {{ t('userEmailFormatTip') }}
                            </n-tooltip>
                        </n-form-item-row>
                        <n-form-item-row label="Redirect URL" required>
                            <n-input v-model:value="item.redirectURL" />
                        </n-form-item-row>
                        <n-form-item-row label="Scope" required>
                            <n-input v-model:value="item.scope" />
                        </n-form-item-row>
                        <n-form-item-row :label="t('enableMailAllowList')">
                            <n-input-group>
                                <n-checkbox v-model:checked="item.enableMailAllowList" style="width: 20%;">
                                    {{ t('enable') }}
                                </n-checkbox>
                                <n-select v-model:value="item.mailAllowList" v-if="item.enableMailAllowList" filterable
                                    multiple tag style="width: 80%;" :options="mailAllowOptions"
                                    :placeholder="t('mailAllowList')">
                                    <template #empty>
                                        <n-text depth="3">
                                            {{ t('manualInputPrompt') }}
                                        </n-text>
                                    </template>
                                </n-select>
                            </n-input-group>
                        </n-form-item-row>
                    </n-form>
                </n-collapse-item>
            </n-collapse>
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
