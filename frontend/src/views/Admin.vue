<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../store'
import { api } from '../api'
import { getRouterPathWithLang } from '../utils'

import SenderAccess from './admin/SenderAccess.vue'
import Statistics from "./admin/Statistics.vue"
import SendBox from './admin/SendBox.vue';
import Account from './admin/Account.vue';
import CreateAccount from './admin/CreateAccount.vue';
import AccountSettings from './admin/AccountSettings.vue';
import UserManagement from './admin/UserManagement.vue';
import UserSettings from './admin/UserSettings.vue';
import UserOauth2Settings from './admin/UserOauth2Settings.vue';
import RoleAddressConfig from './admin/RoleAddressConfig.vue';
import Mails from './admin/Mails.vue';
import MailsUnknow from './admin/MailsUnknow.vue';
import About from './common/About.vue';
import Maintenance from './admin/Maintenance.vue';
import DatabaseManager from './admin/DatabaseManager.vue';
import Appearance from './common/Appearance.vue';
import Telegram from './admin/Telegram.vue';
import Webhook from './admin/Webhook.vue';
import MailWebhook from './admin/MailWebhook.vue';
import WorkerConfig from './admin/WorkerConfig.vue';
import IpBlacklistSettings from './admin/IpBlacklistSettings.vue';
import AiExtractSettings from './admin/AiExtractSettings.vue';

const {
  adminAuth, showAdminAuth, adminTab, loading,
  globalTabplacement, showAdminPage, userSettings,
  openSettings
} = useGlobalState()
const message = useMessage()
const router = useRouter()

const SendMail = defineAsyncComponent(() => {
  loading.value = true;
  return import('./admin/SendMail.vue')
    .finally(() => loading.value = false);
});

const authFunc = async () => {
  try {
    adminAuth.value = tmpAdminAuth.value;
    location.reload()
  } catch (error) {
    message.error(error.message || "error");
  }
}

const showLogoutModal = ref(false)

const handleLogout = async () => {
  // 清空管理员认证
  adminAuth.value = '';
  // 重置管理员相关状态
  showAdminAuth.value = false;
  adminTab.value = 'account';
  // 显示成功提示并跳转
  message.success(t('logoutSuccess'));
  await router.push(getRouterPathWithLang('/', locale.value));
}

const { t, locale } = useI18n({
  messages: {
    en: {
      accessHeader: 'Admin Password',
      accessTip: 'Please enter the admin password',
      mails: 'Emails',
      sendMail: 'Send Mail',
      qucickSetup: 'Quick Setup',
      account: 'Account',
      account_create: 'Create Account',
      account_settings: 'Account Settings',
      user: 'User',
      user_management: 'User Management',
      user_settings: 'User Settings',
      userOauth2Settings: 'Oauth2 Settings',
      roleAddressConfig: 'Role Address Config',
      unknow: 'Mails with unknow receiver',
      senderAccess: 'Sender Access Control',
      sendBox: 'Send Box',
      telegram: 'Telegram Bot',
      webhookSettings: 'Webhook Settings',
      statistics: 'Statistics',
      maintenance: 'Maintenance',
      database: 'Database',
      workerconfig: 'Worker Config',
      ipBlacklistSettings: 'IP Blacklist',
      aiExtractSettings: 'AI Extract Settings',
      appearance: 'Appearance',
      about: 'About',
      ok: 'OK',
      mailWebhook: 'Mail Webhook',
      adminAccount: 'Admin',
      loginMethod: 'Login Method',
      loginViaPassword: 'Admin Password Login',
      loginViaUserAdmin: 'User Admin Permission',
      loginViaDisabledCheck: 'Disabled Password Check',
      logout: 'Logout',
      logoutConfirmTitle: 'Confirm Logout',
      logoutConfirmContent: 'Are you sure you want to logout from admin panel?',
      confirm: 'Confirm',
      logoutSuccess: 'Logout successful',
    },
    zh: {
      accessHeader: 'Admin 密码',
      accessTip: '请输入 Admin 密码',
      mails: '邮件',
      sendMail: '发送邮件',
      qucickSetup: '快速设置',
      account: '账号',
      account_create: '创建账号',
      account_settings: '账号设置',
      user: '用户',
      user_management: '用户管理',
      user_settings: '用户设置',
      userOauth2Settings: 'Oauth2 设置',
      roleAddressConfig: '角色地址配置',
      unknow: '无收件人邮件',
      senderAccess: '发件权限控制',
      sendBox: '发件箱',
      telegram: '电报机器人',
      webhookSettings: 'Webhook 设置',
      statistics: '统计',
      maintenance: '维护',
      database: '数据库',
      workerconfig: 'Worker 配置',
      ipBlacklistSettings: 'IP 黑名单',
      aiExtractSettings: 'AI 提取设置',
      appearance: '外观',
      about: '关于',
      ok: '确定',
      mailWebhook: '邮件 Webhook',
      adminAccount: '管理员',
      loginMethod: '登录方式',
      loginViaPassword: 'Admin 密码登录',
      loginViaUserAdmin: '用户管理员权限',
      loginViaDisabledCheck: '已禁用密码检查',
      logout: '退出登录',
      logoutConfirmTitle: '确认退出',
      logoutConfirmContent: '确定要退出管理员面板吗？',
      confirm: '确认',
      logoutSuccess: '退出成功',
    }
  }
});

const showAdminPasswordModal = computed(() => !showAdminPage.value || showAdminAuth.value)
const tmpAdminAuth = ref('')
// 判断是否通过 admin password 登录（而非用户管理员权限）
const isAdminPasswordLogin = computed(() => !!adminAuth.value)

// 获取当前登录方式
const currentLoginMethod = computed(() => {
  if (adminAuth.value) {
    return t('loginViaPassword');
  } else if (userSettings.value.is_admin) {
    return t('loginViaUserAdmin');
  } else if (openSettings.value.disableAdminPasswordCheck) {
    return t('loginViaDisabledCheck');
  }
  return '';
})

onMounted(async () => {
  // make sure user_id is fetched
  if (!userSettings.value.user_id) await api.getUserSettings(message);
})
</script>

<template>
  <div v-if="userSettings.fetched">
    <n-modal v-model:show="showAdminPasswordModal" :closable="false" :closeOnEsc="false" :maskClosable="false"
      preset="dialog" :title="t('accessHeader')">
      <p>{{ t('accessTip') }}</p>
      <n-input v-model:value="tmpAdminAuth" type="password" show-password-on="click" />
      <template #action>
        <n-button @click="authFunc" type="primary" :loading="loading">
          {{ t('ok') }}
        </n-button>
      </template>
    </n-modal>
    <n-tabs v-if="showAdminPage" type="card" v-model:value="adminTab" :placement="globalTabplacement">
      <n-tab-pane name="qucickSetup" :tab="t('qucickSetup')">
        <n-tabs type="bar" justify-content="center" animated>
          <n-tab-pane name="database" :tab="t('database')">
            <DatabaseManager />
          </n-tab-pane>
          <n-tab-pane name="account_settings" :tab="t('account_settings')">
            <AccountSettings />
          </n-tab-pane>
          <n-tab-pane name="user_settings" :tab="t('user_settings')">
            <UserSettings />
          </n-tab-pane>
          <n-tab-pane name="workerconfig" :tab="t('workerconfig')">
            <WorkerConfig />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="account" :tab="t('account')">
        <n-tabs type="bar" justify-content="center" animated>
          <n-tab-pane name="account" :tab="t('account')">
            <Account />
          </n-tab-pane>
          <n-tab-pane name="account_create" :tab="t('account_create')">
            <CreateAccount />
          </n-tab-pane>
          <n-tab-pane name="account_settings" :tab="t('account_settings')">
            <AccountSettings />
          </n-tab-pane>
          <n-tab-pane name="senderAccess" :tab="t('senderAccess')">
            <SenderAccess />
          </n-tab-pane>
          <n-tab-pane name="ipBlacklistSettings" :tab="t('ipBlacklistSettings')">
            <IpBlacklistSettings />
          </n-tab-pane>
          <n-tab-pane name="aiExtractSettings" :tab="t('aiExtractSettings')">
            <AiExtractSettings />
          </n-tab-pane>
          <n-tab-pane name="webhook" :tab="t('webhookSettings')">
            <Webhook />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="user" :tab="t('user')">
        <n-tabs type="bar" justify-content="center" animated>
          <n-tab-pane name="user_management" :tab="t('user_management')">
            <UserManagement />
          </n-tab-pane>
          <n-tab-pane name="user_settings" :tab="t('user_settings')">
            <UserSettings />
          </n-tab-pane>
          <n-tab-pane name="userOauth2Settings" :tab="t('userOauth2Settings')">
            <UserOauth2Settings />
          </n-tab-pane>
          <n-tab-pane name="roleAddressConfig" :tab="t('roleAddressConfig')">
            <RoleAddressConfig />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="mails" :tab="t('mails')">
        <n-tabs type="bar" justify-content="center" animated>
          <n-tab-pane name="mails" :tab="t('mails')">
            <Mails />
          </n-tab-pane>
          <n-tab-pane name="unknow" :tab="t('unknow')">
            <MailsUnknow />
          </n-tab-pane>
          <n-tab-pane name="sendBox" :tab="t('sendBox')">
            <SendBox />
          </n-tab-pane>
          <n-tab-pane name="sendMail" :tab="t('sendMail')">
            <SendMail />
          </n-tab-pane>
          <n-tab-pane name="mailWebhook" :tab="t('mailWebhook')">
            <MailWebhook />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="telegram" :tab="t('telegram')">
        <Telegram />
      </n-tab-pane>
      <n-tab-pane name="statistics" :tab="t('statistics')">
        <Statistics />
      </n-tab-pane>
      <n-tab-pane name="maintenance" :tab="t('maintenance')">
        <n-tabs type="bar" justify-content="center" animated>
          <n-tab-pane name="database" :tab="t('database')">
            <DatabaseManager />
          </n-tab-pane>
          <n-tab-pane name="workerconfig" :tab="t('workerconfig')">
            <WorkerConfig />
          </n-tab-pane>
          <n-tab-pane name="maintenance" :tab="t('maintenance')">
            <Maintenance />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="appearance" :tab="t('appearance')">
        <Appearance />
      </n-tab-pane>
      <n-tab-pane name="adminAccount" :tab="t('adminAccount')">
        <div style="display: flex; justify-content: center; padding: 20px;">
          <n-card style="width: 600px;">
            <n-space vertical>
              <n-text strong>{{ t('loginMethod') }}</n-text>
              <n-text>{{ currentLoginMethod }}</n-text>
              <n-divider v-if="isAdminPasswordLogin" />
              <n-button v-if="isAdminPasswordLogin" type="warning" @click="showLogoutModal = true" block>
                {{ t('logout') }}
              </n-button>
            </n-space>
          </n-card>
        </div>
      </n-tab-pane>
      <n-tab-pane name="about" :tab="t('about')">
        <About />
      </n-tab-pane>
    </n-tabs>
    <n-modal v-model:show="showLogoutModal" preset="dialog" :title="t('logoutConfirmTitle')">
      <p>{{ t('logoutConfirmContent') }}</p>
      <template #action>
        <n-button :loading="loading" @click="handleLogout" size="small" tertiary type="warning">
          {{ t('confirm') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.n-pagination {
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
