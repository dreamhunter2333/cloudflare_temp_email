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
            icon: 'Icon (SVG, please ensure trusted source)',
            iconPreview: 'Preview',
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
            icon: '图标 (SVG, 请确保来源可信)',
            iconPreview: '预览',
            oauth2Type: 'Oauth2 类型',
            enableEmailFormat: '启用邮箱格式转换',
            userEmailFormat: '邮箱正则表达式',
            userEmailReplace: '替换模板',
            userEmailFormatTip: '使用正则转换邮箱。示例: ^(.+)@old\\.com$ 配合 $1@new.com',
            tip: '第三方登录会自动使用用户邮箱注册账号(邮箱相同将视为同一账号), 此账号和注册的账号相同, 也可以通过忘记密码设置密码',
        }
    }
});

const OAUTH2_ICONS: Record<string, string> = {
    github: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>',
    linuxdo: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em"><g><path d="m7.44,0s.09,0,.13,0c.09,0,.19,0,.28,0,.14,0,.29,0,.43,0,.09,0,.18,0,.27,0q.12,0,.25,0t.26.08c.15.03.29.06.44.08,1.97.38,3.78,1.47,4.95,3.11.04.06.09.12.13.18.67.96,1.15,2.11,1.3,3.28q0,.19.09.26c0,.15,0,.29,0,.44,0,.04,0,.09,0,.13,0,.09,0,.19,0,.28,0,.14,0,.29,0,.43,0,.09,0,.18,0,.27,0,.08,0,.17,0,.25q0,.19-.08.26c-.03.15-.06.29-.08.44-.38,1.97-1.47,3.78-3.11,4.95-.06.04-.12.09-.18.13-.96.67-2.11,1.15-3.28,1.3q-.19,0-.26.09c-.15,0-.29,0-.44,0-.04,0-.09,0-.13,0-.09,0-.19,0-.28,0-.14,0-.29,0-.43,0-.09,0-.18,0-.27,0-.08,0-.17,0-.25,0q-.19,0-.26-.08c-.15-.03-.29-.06-.44-.08-1.97-.38-3.78-1.47-4.95-3.11q-.07-.09-.13-.18c-.67-.96-1.15-2.11-1.3-3.28q0-.19-.09-.26c0-.15,0-.29,0-.44,0-.04,0-.09,0-.13,0-.09,0-.19,0-.28,0-.14,0-.29,0-.43,0-.09,0-.18,0-.27,0-.08,0-.17,0-.25q0-.19.08-.26c.03-.15.06-.29.08-.44.38-1.97,1.47-3.78,3.11-4.95.06-.04.12-.09.18-.13C4.42.73,5.57.26,6.74.1,7,.07,7.15,0,7.44,0Z" fill="#EFEFEF"/><path d="m1.27,11.33h13.45c-.94,1.89-2.51,3.21-4.51,3.88-1.99.59-3.96.37-5.8-.57-1.25-.7-2.67-1.9-3.14-3.3Z" fill="#FEB005"/><path d="m12.54,1.99c.87.7,1.82,1.59,2.18,2.68H1.27c.87-1.74,2.33-3.13,4.2-3.78,2.44-.79,5-.47,7.07,1.1Z" fill="#1D1D1F"/></g></svg>',
    authentik: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.83-3.23 9.36-7 10.57-3.77-1.21-7-5.74-7-10.57V6.3l7-3.12zM11 7v6h2V7h-2zm0 8v2h2v-2h-2z"/></svg>',
};

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
            icon: OAUTH2_ICONS.github,
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
            icon: OAUTH2_ICONS.linuxdo,
        },
        authentik: {
            authorizationURL: 'https://youdomain/application/o/authorize/',
            accessTokenURL: 'https://youdomain/application/o/token/',
            accessTokenFormat: 'urlencoded',
            userInfoURL: 'https://youdomain/application/o/userinfo/',
            userEmailKey: 'email',
            scope: 'email openid',
            icon: OAUTH2_ICONS.authentik,
        },
        custom: {},
    }
    const template = templates[newOauth2Type.value] || {}
    userOauth2Settings.value.push({
        name: newOauth2Name.value,
        icon: '',
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
                        <n-form-item-row :label="t('icon')">
                            <n-input v-model:value="item.icon" type="textarea"
                                :autosize="{ minRows: 2, maxRows: 5 }" style="width: 100%;" />
                        </n-form-item-row>
                        <n-form-item-row v-if="item.icon" :label="t('iconPreview')">
                            <span class="oauth2-icon-preview" v-html="item.icon"></span>
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

.oauth2-icon-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--n-border-color);
    border-radius: 4px;
    padding: 4px;
}

.oauth2-icon-preview :deep(svg) {
    width: 100%;
    height: 100%;
}
</style>
