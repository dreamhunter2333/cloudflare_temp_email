<script setup>
import { computed } from 'vue'

import { useScopedI18n } from '@/i18n/app'

import AddressCredentialContent from './AddressCredentialContent.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  address: {
    type: String,
    default: '',
  },
  jwt: {
    type: String,
    default: '',
  },
  addressPassword: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:show'])
const { t } = useScopedI18n('components.AddressCredentialModal')

const modalShow = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})
</script>

<template>
  <n-modal v-model:show="modalShow" preset="card" :title="t('title')"
    style="width: min(760px, calc(100vw - 32px));">
    <AddressCredentialContent :address="address" :jwt="jwt" :address-password="addressPassword" />
  </n-modal>
</template>
