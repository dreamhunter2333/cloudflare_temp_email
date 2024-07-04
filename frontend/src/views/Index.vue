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
import Webhook from './index/Webhook.vue';
import Attachment from './index/Attachment.vue';
import About from './common/About.vue';

const SendMail = defineAsyncComponent(() => import('./index/SendMail.vue'));
const { settings, openSettings, indexTab, globalTabplacement } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
  messages: {
    en: {
      mailbox: 'Mail Box',
      sendbox: 'Send Box',
      sendmail: 'Send Mail',
      auto_reply: 'Auto Reply',
      accountSettings: 'Account Settings',
      about: 'About',
      s3Attachment: 'S3 Attachment',
      saveToS3Success: 'save to s3 success',
    },
    zh: {
      mailbox: '收件箱',
      sendbox: '发件箱',
      sendmail: '发送邮件',
      auto_reply: '自动回复',
      accountSettings: '账户设置',
      about: '关于',
      s3Attachment: 'S3附件',
      saveToS3Success: '保存到s3成功',
    }
  }
});

const fetchMailData = async (limit, offset) => {
  return await api.fetch(`/api/mails?limit=${limit}&offset=${offset}`);
};

const deleteMail = async (curMailId) => {
  await api.fetch(`/api/mails/${curMailId}`, { method: 'DELETE' });
};

const deleteSenboxMail = async (curMailId) => {
  await api.fetch(`/api/sendbox/${curMailId}`, { method: 'DELETE' });
};

const fetchSenboxData = async (limit, offset) => {
  return await api.fetch(`/api/sendbox?limit=${limit}&offset=${offset}`);
};

const saveToS3 = async (mail_id, filename, blob) => {
  try {
    const { url } = await api.fetch(`/api/attachment/put_url`, {
      method: 'POST',
      body: JSON.stringify({ key: `${mail_id}/${filename}` })
    });
    // upload to s3 by formdata
    const formData = new FormData();
    formData.append(filename, blob);
    await fetch(url, {
      method: 'PUT',
      body: formData
    });
    message.success(t('saveToS3Success'));
  } catch (error) {
    console.error(error);
    message.error(error.message || "save to s3 error");
  }
}
</script>

<template>
  <div>
    <AddressBar />
    <n-tabs v-if="settings.address" type="card" v-model:value="indexTab" :placement="globalTabplacement">
      <n-tab-pane name="mailbox" :tab="t('mailbox')">
        <MailBox :showEMailTo="false" :showReply="true" :showSaveS3="openSettings.isS3Enabled" :saveToS3="saveToS3"
          :enableUserDeleteEmail="openSettings.enableUserDeleteEmail" :fetchMailData="fetchMailData"
          :deleteMail="deleteMail" />
      </n-tab-pane>
      <n-tab-pane name="sendbox" :tab="t('sendbox')">
        <SendBox :fetchMailData="fetchSenboxData" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
          :deleteMail="deleteSenboxMail" />
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
        <Webhook />
      </n-tab-pane>
      <n-tab-pane v-if="openSettings.isS3Enabled" name="s3_attachment" :tab="t('s3Attachment')">
        <Attachment />
      </n-tab-pane>
      <n-tab-pane v-if="openSettings.enableIndexAbout" name="about" :tab="t('about')">
        <About />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>
