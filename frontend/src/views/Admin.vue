<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../store'

import SenderAccess from './admin/SenderAccess.vue'
import Statistics from "./admin/Statistics.vue"
import SendBox from './admin/SendBox.vue';
import Account from './admin/Account.vue';
import CreateAccount from './admin/CreateAccount.vue';
import AccountSettings from './admin/AccountSettings.vue';
import UserManagement from './admin/UserManagement.vue';
import UserSettings from './admin/UserSettings.vue';
import Mails from './admin/Mails.vue';
import MailsUnknow from './admin/MailsUnknow.vue';
import About from './common/About.vue';
import Maintenance from './admin/Maintenance.vue';
import Appearance from './common/Appearance.vue';
import Telegram from './admin/Telegram.vue';
import Webhook from './admin/Webhook.vue';

const {
  adminAuth, showAdminAuth, adminTab, loading,
  globalTabplacement, showAdminPage
} = useGlobalState()
const message = useMessage()

const authFunc = async () => {
  try {
    location.reload()
  } catch (error) {
    message.error(error.message || "error");
  }
}

const { t } = useI18n({
  messages: {
    en: {
      accessHeader: 'Admin Password',
      accessTip: 'Please enter the admin password',
      mails: 'Emails',
      account: 'Account',
      account_create: 'Create Account',
      account_settings: 'Account Settings',
      user: 'User',
      user_management: 'User Management',
      user_settings: 'User Settings',
      unknow: 'Mails with unknow receiver',
      senderAccess: 'Sender Access Control',
      sendBox: 'Send Box',
      telegram: 'Telegram Bot',
      webhook: 'Webhook',
      statistics: 'Statistics',
      maintenance: 'Maintenance',
      appearance: 'Appearance',
      about: 'About',
      ok: 'OK',
    },
    zh: {
      accessHeader: 'Admin 密码',
      accessTip: '请输入 Admin 密码',
      mails: '邮件',
      account: '账号',
      account_create: '创建账号',
      account_settings: '账号设置',
      user: '用户',
      user_management: '用户管理',
      user_settings: '用户设置',
      unknow: '无收件人邮件',
      senderAccess: '发件权限控制',
      sendBox: '发件箱',
      telegram: '电报机器人',
      webhook: 'Webhook',
      statistics: '统计',
      maintenance: '维护',
      appearance: '外观',
      about: '关于',
      ok: '确定',
    }
  }
});

onMounted(async () => {
  if (!showAdminPage.value) {
    showAdminAuth.value = true;
    return;
  }
})
</script>

<template>
  <div>
    <n-modal v-model:show="showAdminAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
      :title="t('accessHeader')">
      <p>{{ t('accessTip') }}</p>
      <n-input v-model:value="adminAuth" type="textarea" :autosize="{ minRows: 3 }" />
      <template #action>
        <n-button @click="authFunc" type="primary" :loading="loading">
          {{ t('ok') }}
        </n-button>
      </template>
    </n-modal>
    <n-tabs v-if="showAdminPage" type="card" v-model:value="adminTab" :placement="globalTabplacement">
      <n-tab-pane name="account" :tab="t('account')">
        <n-tabs type="bar" animated>
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
          <n-tab-pane name="webhook" :tab="t('webhook')">
            <Webhook />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="user" :tab="t('user')">
        <n-tabs type="bar" animated>
          <n-tab-pane name="user_management" :tab="t('user_management')">
            <UserManagement />
          </n-tab-pane>
          <n-tab-pane name="user_settings" :tab="t('user_settings')">
            <UserSettings />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="mails" :tab="t('mails')">
        <n-tabs type="bar" animated>
          <n-tab-pane name="mails" :tab="t('mails')">
            <Mails />
          </n-tab-pane>
          <n-tab-pane name="unknow" :tab="t('unknow')">
            <MailsUnknow />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="sendBox" :tab="t('sendBox')">
        <SendBox />
      </n-tab-pane>
      <n-tab-pane name="telegram" :tab="t('telegram')">
        <Telegram />
      </n-tab-pane>
      <n-tab-pane name="statistics" :tab="t('statistics')">
        <Statistics />
      </n-tab-pane>
      <n-tab-pane name="maintenance" :tab="t('maintenance')">
        <Maintenance />
      </n-tab-pane>
      <n-tab-pane name="appearance" :tab="t('appearance')">
        <Appearance />
      </n-tab-pane>
      <n-tab-pane name="about" :tab="t('about')">
        <About />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<style scoped>
.n-pagination {
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
