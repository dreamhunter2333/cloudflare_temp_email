<script setup>
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../../store'
const { openSettings } = useGlobalState()

const { t } = useScopedI18n('views.common.AdminContact')
</script>

<template>
    <n-alert v-if="openSettings.adminContact" :show-icon="false" :bordered="false">
        <span>{{ t('adminContact', { msg: openSettings.adminContact }) }}</span>
    </n-alert>
</template>
