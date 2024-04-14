<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../store'

import SenderAccess from './admin/SenderAccess.vue'
import Statistics from "./admin/Statistics.vue"
import SendBox from './admin/SendBox.vue';
import Account from './admin/Account.vue';
import Mails from './admin/Mails.vue';
import MailsUnknow from './admin/MailsUnknow.vue';
import Maintenance from './admin/Maintenance.vue';

const {
  localeCache, adminAuth, showAdminAuth, adminTab
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
  locale: localeCache.value || 'zh',
  messages: {
    en: {
      auth: 'Admin Auth',
      authTip: 'Please enter the correct auth code',
      mails: 'Emails',
      account: 'Account',
      unknow: 'Mails with unknow receiver',
      senderAccess: 'Sender Access Control',
      sendBox: 'Send Box',
      maintenance: 'Maintenance',
    },
    zh: {
      auth: 'Admin 授权',
      authTip: '请输入正确的授权码',
      mails: '邮件',
      account: '账号',
      unknow: '无收件人邮件',
      senderAccess: '发件权限控制',
      sendBox: '发件箱',
      maintenance: '维护',
    }
  }
});

onMounted(async () => {
  if (!adminAuth.value) {
    showAdminAuth.value = true;
    return;
  }
})
</script>

<template>
  <div>
    <n-modal v-model:show="showAdminAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
      title="Dialog">
      <template #header>
        <div>{{ t('auth') }}</div>
      </template>
      <p>{{ t('authTip') }}</p>
      <n-input v-model:value="adminAuth" type="textarea" :autosize="{ minRows: 3 }" />
      <template #action>
        <n-button @click="authFunc" size="small" tertiary round type="primary">
          {{ t('auth') }}
        </n-button>
      </template>
    </n-modal>
    <Statistics />
    <n-tabs type="card" v-model:value="adminTab">
      <n-tab-pane name="account" :tab="t('account')">
        <Account />
      </n-tab-pane>
      <n-tab-pane name="mails" :tab="t('mails')">
        <Mails />
      </n-tab-pane>
      <n-tab-pane name="unknow" :tab="t('unknow')">
        <MailsUnknow />
      </n-tab-pane>
      <n-tab-pane name="senderAccess" :tab="t('senderAccess')">
        <SenderAccess />
      </n-tab-pane>
      <n-tab-pane name="sendBox" :tab="t('sendBox')">
        <SendBox />
      </n-tab-pane>
      <n-tab-pane name="maintenance" :tab="t('maintenance')">
        <Maintenance />
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
