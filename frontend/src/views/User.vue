<script setup>
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../store'

import AddressMangement from './user/AddressManagement.vue';
import UserSettingsPage from './user/UserSettings.vue';
import UserBar from './user/UserBar.vue';
import BindAddress from './user/BindAddress.vue';
import UserMailBox from './user/UserMailBox.vue';

const {
    userTab, globalTabplacement, userSettings
} = useGlobalState()

const { t } = useI18n({
    messages: {
        en: {
            address_management: 'Address Management',
            user_mail_box_tab: 'Mail Box',
            user_settings: 'User Settings',
            bind_address: 'Bind Mail Address',
        },
        zh: {
            address_management: '地址管理',
            user_mail_box_tab: '收件箱',
            user_settings: '用户设置',
            bind_address: '绑定邮箱地址',
        }
    }
});

</script>

<template>
    <div>
        <UserBar />
        <n-tabs v-if="userSettings.user_email" type="card" v-model:value="userTab" :placement="globalTabplacement">
            <n-tab-pane name="address_management" :tab="t('address_management')">
                <AddressMangement />
            </n-tab-pane>
            <n-tab-pane name="user_mail_box_tab" :tab="t('user_mail_box_tab')">
                <UserMailBox />
            </n-tab-pane>
            <n-tab-pane name="user_settings" :tab="t('user_settings')">
                <UserSettingsPage />
            </n-tab-pane>
            <n-tab-pane name="bind_address" :tab="t('bind_address')">
                <BindAddress />
            </n-tab-pane>
        </n-tabs>
    </div>
</template>
