<script setup>
import MailBox from './MailBox.vue';
import { useGlobalState } from '../store'
const { settings } = useGlobalState()
</script>

<template>
  <div>
    <MailBox v-if="settings.address" />
  </div>
</template>
