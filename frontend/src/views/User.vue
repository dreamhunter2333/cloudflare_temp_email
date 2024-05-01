<script setup>
import { useI18n } from 'vue-i18n'
import { useStorage } from '@vueuse/core'

import { useGlobalState } from '../store'

import AutoReply from './user/AutoReply.vue';
import SendBox from './send/SendBox.vue';
import Account from './user/Account.vue';

const { localeCache, settings, openSettings } = useGlobalState()
const userTab = useStorage('userTab', 'account')

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            sendbox: 'Send Box',
            auto_reply: 'Auto Reply',
            account: 'Account',
        },
        zh: {
            sendbox: '发件箱',
            auto_reply: '自动回复',
            account: '账户',
        }
    }
});

</script>

<template>
    <div v-if="settings.address">
        <n-tabs type="card" v-model:value="userTab">
            <n-tab-pane name="account" :tab="t('account')">
                <Account />
            </n-tab-pane>
            <n-tab-pane name="sendbox" :tab="t('sendbox')">
                <SendBox />
            </n-tab-pane>
            <n-tab-pane v-if="openSettings.enableAutoReply" name="auto_reply" :tab="t('auto_reply')">
                <AutoReply />
            </n-tab-pane>
        </n-tabs>
    </div>
</template>
