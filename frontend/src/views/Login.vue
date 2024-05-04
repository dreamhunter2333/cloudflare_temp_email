<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminContact from './admin/AdminContact.vue'
import Turnstile from '../components/Turnstile.vue'

import { useGlobalState } from '../store'
import { api } from '../api'
const message = useMessage()
const router = useRouter()

const {
    jwt, localeCache, loading, openSettings, showPassword
} = useGlobalState()

const tabValue = ref('signin')
const password = ref('')
const emailName = ref("")
const emailDomain = ref("")
const cfToken = ref("")

const login = async () => {
    if (!password.value) {
        message.error(t('passwordInput'));
        return;
    }
    try {
        jwt.value = password.value;
        await api.getSettings()
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
}

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            login: 'Login',
            pleaseGetNewEmail: 'Please login or click "Get New Email" button to get a new email address',
            getNewEmail: 'Get New Email',
            getNewEmailTip1: 'Please input the email you want to use. only allow ., a-z, A-Z and 0-9',
            getNewEmailTip2: 'Levaing it blank will generate a random email address.',
            getNewEmailTip3: 'You can choose a domain from the dropdown list.',
            password: 'Password',
            ok: 'OK',
            generateName: 'Generate Fake Name',
            help: 'Help',
            passwordInput: 'Please input the password',
        },
        zh: {
            login: '登录',
            pleaseGetNewEmail: '请"登录"或点击 "获取新邮箱" 按钮来获取一个新的邮箱地址',
            getNewEmail: '注册新邮箱',
            getNewEmailTip1: '请输入你想要使用的邮箱地址, 只允许 ., a-z, A-Z, 0-9',
            getNewEmailTip2: '留空将会生成一个随机的邮箱地址。',
            getNewEmailTip3: '你可以从下拉列表中选择一个域名。',
            password: '密码',
            ok: '确定',
            generateName: '生成随机名字',
            help: '帮助',
            passwordInput: '请输入密码',
        }
    }
});

const generateNameLoading = ref(false);
const generateName = async () => {
    try {
        generateNameLoading.value = true;
        const { faker } = await import('https://esm.sh/@faker-js/faker');
        emailName.value = faker.person
            .fullName()
            .replace(/\s+/g, '.')
            .replace(/[^a-zA-Z0-9.]/g, '')
            .toLowerCase();
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        generateNameLoading.value = false;
    }
};

const newEmail = async () => {
    try {
        const res = await api.fetch(`/api/new_address`, {
            method: "POST",
            body: JSON.stringify({
                name: emailName.value,
                domain: emailDomain.value,
                cf_token: cfToken.value,
            }),
        });
        jwt.value = res["jwt"];
        await api.getSettings();
        showPassword.value = true;
    } catch (error) {
        message.error(error.message || "error");
    }
};

onMounted(async () => {
    emailDomain.value = openSettings.value.domains ? openSettings.value.domains[0]?.value : "";
});
</script>

<template>
    <div>
        <n-tabs v-model:value="tabValue" size="large" justify-content="space-evenly">
            <n-tab-pane name="signin" :tab="t('login')">
                <n-form>
                    <n-form-item-row :label="t('password')" required>
                        <n-input v-model:value="password" type="textarea" :autosize="{ minRows: 3 }" />
                    </n-form-item-row>
                    <n-button @click="login" :loading="loading" type="primary" block secondary strong>
                        {{ t('login') }}
                    </n-button>
                    <n-button v-if="openSettings.enableUserCreateEmail" @click="tabValue = 'register'" block secondary
                        strong>
                        {{ t('getNewEmail') }}
                    </n-button>
                </n-form>
            </n-tab-pane>
            <n-tab-pane v-if="openSettings.enableUserCreateEmail" name="register" :tab="t('getNewEmail')">
                <n-spin :show="generateNameLoading">
                    <n-form>
                        <span>
                            <p>{{ t("getNewEmailTip1") }}</p>
                            <p>{{ t("getNewEmailTip2") }}</p>
                            <p>{{ t("getNewEmailTip3") }}</p>
                        </span>
                        <n-button @click="generateName" style="margin-bottom: 10px;">
                            {{ t('generateName') }}
                        </n-button>
                        <n-input-group>
                            <n-input-group-label v-if="openSettings.prefix">
                                {{ openSettings.prefix }}
                            </n-input-group-label>
                            <n-input v-model:value="emailName" />
                            <n-input-group-label>@</n-input-group-label>
                            <n-select v-model:value="emailDomain" :consistent-menu-width="false"
                                :options="openSettings.domains" />
                        </n-input-group>
                        <Turnstile v-model:value="cfToken" />
                        <n-button type="primary" block secondary strong @click="newEmail" :loading="loading">
                            {{ t('ok') }}
                        </n-button>
                    </n-form>
                </n-spin>
            </n-tab-pane>
            <n-tab-pane name="help" :tab="t('help')">
                <n-alert type="info" show-icon>
                    <span>{{ t('pleaseGetNewEmail') }}</span>
                </n-alert>
                <AdminContact />
            </n-tab-pane>
        </n-tabs>
    </div>
</template>


<style scoped>
.n-alert {
    margin-top: 10px;
    margin-bottom: 10px;
    text-align: center;
}

.n-form .n-button {
    margin-top: 10px;
}
</style>
