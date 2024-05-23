<script setup>
import { defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../store'
import { api } from '../api'

import AddressBar from './index/AddressBar.vue';
import MailBox from '../components/MailBox.vue';
import SendBox from '../components/SendBox.vue';
import AutoReply from './index/AutoReply.vue';
import AccountSettings from './index/AccountSettings.vue';
import WenHook from './index/Webhook.vue';
import About from './common/About.vue';

const SendMail = defineAsyncComponent(() => import('./index/SendMail.vue'));
const { localeCache, settings, openSettings, indexTab, globalTabplacement } = useGlobalState()

const { t } = useI18n({
  locale: localeCache.value || 'zh',
  messages: {
    en: {
      mailbox: 'Mail Box',
      sendbox: 'Send Box',
      sendmail: 'Send Mail',
      auto_reply: 'Auto Reply',
      accountSettings: 'Account Settings',
      about: 'About',
    },
    zh: {
      mailbox: '收件箱',
      sendbox: '发件箱',
      sendmail: '发送邮件',
      auto_reply: '自动回复',
      accountSettings: '账户设置',
      about: '关于',
    }
  }
});

const fetchMailData = async (limit, offset) => {
  return await api.fetch(`/api/mails?limit=${limit}&offset=${offset}`);
};

const deleteMail = async (curMailId) => {
  await api.fetch(`/api/mails/${curMailId}`, { method: 'DELETE' });
};

const fetchSenboxData = async (limit, offset) => {
  return await api.fetch(`/api/sendbox?limit=${limit}&offset=${offset}`);
};
</script>

<template>
  <div>
    <AddressBar />
    <n-tabs v-if="settings.address" type="card" v-model:value="indexTab" :placement="globalTabplacement">
      <n-tab-pane name="mailbox" :tab="t('mailbox')">
        <MailBox :showEMailTo="false" :showReply="true" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
          :fetchMailData="fetchMailData" :deleteMail="deleteMail" />
      </n-tab-pane>
      <n-tab-pane name="sendbox" :tab="t('sendbox')">
        <SendBox :fetchMailData="fetchSenboxData" />
      </n-tab-pane>
      <n-tab-pane name="sendmail" :tab="t('sendmail')">
        <SendMail />
      </n-tab-pane>
      <n-tab-pane name="accountSettings" :tab="t('accountSettings')">
        <AccountSettings />
      </n-tab-pane>
      <n-tab-pane v-if="openSettings.enableAutoReply" name="auto_reply" :tab="t('auto_reply')">
        <AutoReply />
      </n-tab-pane>
      <n-tab-pane v-if="openSettings.enableWebhook" name="webhook" :tab="t('webhook')">
        <WenHook />
      </n-tab-pane>
      <n-tab-pane v-if="openSettings.enableIndexAbout" name="about" :tab="t('about')">
        <About />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>
