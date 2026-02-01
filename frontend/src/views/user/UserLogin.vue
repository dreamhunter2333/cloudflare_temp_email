<script setup>
import { useMessage } from 'naive-ui'
import { onMounted, ref } from "vue";
import { useI18n } from 'vue-i18n'
import { KeyFilled } from '@vicons/material'

import { api } from '../../api';
import { useGlobalState } from '../../store'
import { hashPassword } from '../../utils';
import { startAuthentication } from '@simplewebauthn/browser';

import Turnstile from '../../components/Turnstile.vue';

const {
    userJwt, userOpenSettings, openSettings,
    userOauth2SessionState, userOauth2SessionClientID
} = useGlobalState()
const message = useMessage();

const { t } = useI18n({
    messages: {
        en: {
            login: 'Login',
            register: 'Register',
            email: 'Email',
            password: 'Password',
            verifyCode: 'Verification Code',
            verifyCodeSent: 'Verification Code Sent, expires in {timeout} seconds',
            waitforVerifyCode: 'Wait for {timeout} seconds',
            sendVerificationCode: 'Send Verification Code',
            forgotPassword: 'Forgot Password',
            cannotForgotPassword: 'Mail verification is disabled or register is disabled, cannot reset password, please contact administrator',
            resetPassword: 'Reset Password',
            pleaseInput: 'Please input email and password',
            pleaseInputEmail: 'Please input email',
            pleaseInputCode: 'Please input code',
            pleaseCompleteTurnstile: 'Please complete turnstile',
            pleaseLogin: 'Please login',
            loginWithPasskey: 'Login with Passkey',
            loginWith: 'Login with {provider}',
        },
        zh: {
            login: '登录',
            register: '注册',
            email: '邮箱',
            password: '密码',
            verifyCode: '验证码',
            sendVerificationCode: '发送验证码',
            verifyCodeSent: '验证码已发送, {timeout} 秒后失效',
            waitforVerifyCode: '等待{timeout}秒',
            forgotPassword: '忘记密码',
            cannotForgotPassword: '未开启邮箱验证或未开启注册功能，无法重置密码，请联系管理员',
            resetPassword: '重置密码',
            pleaseInput: '请输入邮箱和密码',
            pleaseInputEmail: '请输入邮箱',
            pleaseInputCode: '请输入验证码',
            pleaseCompleteTurnstile: '请完成人机验证',
            pleaseLogin: '请登录',
            loginWithPasskey: '使用 Passkey 登录',
            loginWith: '使用 {provider} 登录',
        }
    }
});

const tabValue = ref("signin");
const showModal = ref(false);
const user = ref({
    email: "",
    password: "",
    code: ""
});
const cfToken = ref("")

const emailLogin = async () => {
    if (!user.value.email || !user.value.password) {
        message.error(t('pleaseInput'));
        return;
    }
    try {
        const res = await api.fetch(`/user_api/login`, {
            method: "POST",
            body: JSON.stringify({
                email: user.value.email,
                // hash password
                password: await hashPassword(user.value.password)
            })
        });
        userJwt.value = res.jwt;
        location.reload();
    } catch (error) {
        message.error(error.message || "login failed");
    }
};

const verifyCodeExpire = ref(0);
const verifyCodeTimeout = ref(0);

const getVerifyCodeTimeout = () => {
    if (!verifyCodeExpire.value || verifyCodeExpire.value < new Date().getTime()) return 0;
    return Math.round((verifyCodeExpire.value - new Date().getTime()) / 1000);
};

const sendVerificationCode = async () => {
    if (!user.value.email) {
        message.error(t('pleaseInputEmail'));
        return;
    }
    if (openSettings.value.cfTurnstileSiteKey && !cfToken.value && userOpenSettings.value.enableMailVerify) {
        message.error(t('pleaseCompleteTurnstile'));
        return;
    }
    try {
        const res = await api.fetch(`/user_api/verify_code`, {
            method: "POST",
            body: JSON.stringify({
                email: user.value.email,
                cf_token: cfToken.value
            })
        });
        if (res && res.expirationTtl) {
            message.success(t('verifyCodeSent', { timeout: res.expirationTtl }));
            verifyCodeExpire.value = new Date().getTime() + res.expirationTtl * 1000;
            const intervalId = setInterval(() => {
                verifyCodeTimeout.value = getVerifyCodeTimeout();
                if (verifyCodeTimeout.value <= 0) {
                    clearInterval(intervalId);
                    verifyCodeTimeout.value = 0;
                }
            }, 1000);
        }
    } catch (error) {
        message.error(error.message || "send verification code failed");
    }
};

const emailSignup = async () => {
    if (!user.value.email || !user.value.password) {
        message.error(t('pleaseInput'));
        return;
    }
    if (!user.value.code && userOpenSettings.value.enableMailVerify) {
        message.error(t('pleaseInputCode'));
        return;
    }
    try {
        const res = await api.fetch(`/user_api/register`, {
            method: "POST",
            body: JSON.stringify({
                email: user.value.email,
                // hash password
                password: await hashPassword(user.value.password),
                code: user.value.code
            }),
            message: message
        });
        if (res) {
            tabValue.value = "signin";
            message.success(t('pleaseLogin'));
        }
        showModal.value = false;
    } catch (error) {
        message.error(error.message || "register failed");
    }
};

const passkeyLogin = async () => {
    try {
        const options = await api.fetch(`/user_api/passkey/authenticate_request`, {
            method: 'POST',
            body: JSON.stringify({
                domain: location.hostname,
            })
        })
        const credential = await startAuthentication(options)

        // Send the result to the server and return the promise.
        const res = await api.fetch(`/user_api/passkey/authenticate_response`, {
            method: 'POST',
            body: JSON.stringify({
                origin: location.origin,
                domain: location.hostname,
                credential
            })
        })
        userJwt.value = res.jwt;
        location.reload();
    } catch (e) {
        console.error(e)
        message.error(e.message)
    }
};

const oauth2Login = async (clientID) => {
    try {
        userOauth2SessionClientID.value = clientID;
        userOauth2SessionState.value = Math.random().toString(36).substring(2);
        const res = await api.fetch(`/user_api/oauth2/login_url?clientID=${clientID}&state=${userOauth2SessionState.value}`);
        // redirect to oauth2 login page
        location.href = res.url;
    } catch (error) {
        message.error(error.message || "login failed");
    }
};

onMounted(async () => {

});
</script>

<template>
    <div class="center">
        <n-tabs v-model:value="tabValue" size="large" v-if="userOpenSettings.fetched" justify-content="space-evenly">
            <n-tab-pane name="signin" :tab="t('login')">
                <n-form>
                    <n-form-item-row :label="t('email')" required>
                        <n-input v-model:value="user.email" />
                    </n-form-item-row>
                    <n-form-item-row :label="t('password')" required>
                        <n-input v-model:value="user.password" type="password" show-password-on="click" />
                    </n-form-item-row>
                    <n-button @click="emailLogin" type="primary" block secondary strong>
                        {{ t('login') }}
                    </n-button>
                    <n-button @click="showModal = true" type="info" quaternary size="tiny">
                        {{ t('forgotPassword') }}
                    </n-button>
                    <n-divider />
                    <n-button @click="passkeyLogin" type="primary" block secondary strong>
                        <template #icon>
                            <n-icon :component="KeyFilled" />
                        </template>
                        {{ t('loginWithPasskey') }}
                    </n-button>
                    <n-button @click="oauth2Login(item.clientID)" v-for="item in userOpenSettings.oauth2ClientIDs"
                        :key="item.clientID" block secondary strong>
                        <template #icon v-if="item.icon">
                            <span class="oauth2-icon" v-html="item.icon"></span>
                        </template>
                        {{ t('loginWith', { provider: item.name }) }}
                    </n-button>
                </n-form>
            </n-tab-pane>
            <n-tab-pane v-if="userOpenSettings.enable" name="signup" :tab="t('register')">
                <n-form>
                    <n-form-item-row :label="t('email')" required>
                        <n-input v-model:value="user.email" />
                    </n-form-item-row>
                    <n-form-item-row :label="t('password')" required>
                        <n-input v-model:value="user.password" type="password" show-password-on="click" />
                    </n-form-item-row>
                    <Turnstile v-if="userOpenSettings.enableMailVerify" v-model:value="cfToken" />
                    <n-form-item-row v-if="userOpenSettings.enableMailVerify" :label="t('verifyCode')" required>
                        <n-input-group>
                            <n-input v-model:value="user.code" />
                            <n-button @click="sendVerificationCode" style="margin-bottom: 0" type="primary" ghost
                                :disabled="verifyCodeTimeout > 0">
                                {{ verifyCodeTimeout > 0 ? t('waitforVerifyCode', { timeout: verifyCodeTimeout })
                                    : t('sendVerificationCode') }}
                            </n-button>
                        </n-input-group>
                    </n-form-item-row>
                </n-form>
                <n-button @click="emailSignup" type="primary" block secondary strong>
                    {{ t('register') }}
                </n-button>
            </n-tab-pane>
        </n-tabs>
        <n-modal v-model:show="showModal" style="max-width: 600px;" preset="card" :title="t('forgotPassword')">
            <n-form v-if="userOpenSettings.enable && userOpenSettings.enableMailVerify">
                <n-form-item-row :label="t('email')" required>
                    <n-input v-model:value="user.email" />
                </n-form-item-row>
                <n-form-item-row :label="t('password')" required>
                    <n-input v-model:value="user.password" type="password" show-password-on="click" />
                </n-form-item-row>
                <Turnstile v-model:value="cfToken" />
                <n-form-item-row :label="t('verifyCode')" required>
                    <n-input-group>
                        <n-input v-model:value="user.code" />
                        <n-button @click="sendVerificationCode" style="margin-bottom: 0" type="primary" ghost
                            :disabled="verifyCodeTimeout > 0">
                            {{ verifyCodeTimeout > 0 ? t('waitforVerifyCode', { timeout: verifyCodeTimeout })
                                : t('sendVerificationCode') }}
                        </n-button>
                    </n-input-group>
                </n-form-item-row>
                <n-button @click="emailSignup" type="primary" block secondary strong>
                    {{ t('resetPassword') }}
                </n-button>
            </n-form>
            <n-alert v-else :show-icon="false" :bordered="false">
                <span>
                    {{ t('cannotForgotPassword') }}
                </span>
            </n-alert>
        </n-modal>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
}

.n-button {
    margin-top: 10px;
}

.oauth2-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
}

.oauth2-icon :deep(svg) {
    width: 100%;
    height: 100%;
}
</style>
