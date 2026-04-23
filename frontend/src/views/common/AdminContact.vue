<script setup>
import { useAppI18n as useI18n } from '@/app-i18n'
import { useGlobalState } from '../../store'
const { openSettings } = useGlobalState()

const { t } = useI18n({
    messages: {
        en: {
            adminContact: 'If you need help, please contact the administrator ({msg})',
        },
        zh: {
            adminContact: '如果你需要帮助，请联系管理员 ({msg})',
        }
    }
});
</script>

<template>
    <n-alert v-if="openSettings.adminContact" :show-icon="false" :bordered="false">
        <span>{{ t('adminContact', { msg: openSettings.adminContact }) }}</span>
    </n-alert>
</template>
