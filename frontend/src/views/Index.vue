<script setup>
import MailBox from '../components/MailBox.vue';
import { useGlobalState } from '../store'
import { api } from '../api'

const { settings, openSettings } = useGlobalState()

const fetchMailData = async (limit, offset) => {
  return await api.fetch(`/api/mails?limit=${limit}&offset=${offset}`);
};

const deleteMail = async (curMailId) => {
  await api.fetch(`/api/mails/${curMailId}`, { method: 'DELETE' });
};
</script>

<template>
  <div v-if="settings.address">
    <MailBox :showEMailTo="false" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
      :fetchMailData="fetchMailData" :deleteMail="deleteMail" />
  </div>
</template>
