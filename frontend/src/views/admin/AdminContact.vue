<script setup>
import { useI18n } from 'vue-i18n'
import { useGlobalState } from '../../store'
const { localeCache, openSettings } = useGlobalState()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
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
    <n-alert v-if="openSettings.adminContact" type="info" show-icon>
        <span>{{ t('adminContact', { msg: openSettings.adminContact }) }}</span>
    </n-alert>
</template>
