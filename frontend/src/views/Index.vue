<script setup>
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../store'
import { api } from '../api'

import AddressBar from './index/AddressBar.vue';
import MailBox from '../components/MailBox.vue';
import AutoReply from './index/AutoReply.vue';
import SendBox from './index/SendBox.vue';
import SendMail from './index/SendMail.vue';
import AccountSettings from './index/AccountSettings.vue';

const { localeCache, settings, openSettings, indexTab } = useGlobalState()

const { t } = useI18n({
  locale: localeCache.value || 'zh',
  messages: {
    en: {
      mailbox: 'Mail Box',
      sendbox: 'Send Box',
      sendmail: 'Send Mail',
      auto_reply: 'Auto Reply',
      accountSettings: 'Account Settings',
    },
    zh: {
      mailbox: '收件箱',
      sendbox: '发件箱',
      sendmail: '发送邮件',
      auto_reply: '自动回复',
      accountSettings: '账户设置',
    }
  }
});

const fetchMailData = async (limit, offset) => {
  return await api.fetch(`/api/mails?limit=${limit}&offset=${offset}`);
};

const deleteMail = async (curMailId) => {
  await api.fetch(`/api/mails/${curMailId}`, { method: 'DELETE' });
};
</script>

<template>
  <div>
    <AddressBar />
    <n-tabs v-if="settings.address" type="card" v-model:value="indexTab">
      <n-tab-pane name="mailbox" :tab="t('mailbox')">
        <MailBox :showEMailTo="false" :showReply="true" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
          :fetchMailData="fetchMailData" :deleteMail="deleteMail" />
      </n-tab-pane>
      <n-tab-pane name="sendbox" :tab="t('sendbox')">
        <SendBox />
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
    </n-tabs>
  </div>
</template>
