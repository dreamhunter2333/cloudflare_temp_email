<script setup>
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../store'

import AddressMangement from './user/AddressManagement.vue';
import UserSettingsPage from './user/UserSettings.vue';
import UserBar from './user/UserBar.vue';
import BindAddress from './user/BindAddress.vue';
import UserMailBox from './user/UserMailBox.vue';
import UserSendBox from './user/UserSendBox.vue';

const {
    userTab, globalTabplacement, userSettings, openSettings
} = useGlobalState()

const { t } = useScopedI18n('views.User')
const { t: userMailT } = useScopedI18n('views.user.UserSendBox')

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
            <n-tab-pane v-if="openSettings.enableSendMail" name="user_sendbox" :tab="userMailT('sendbox')">
                <UserSendBox mode="sendbox" />
            </n-tab-pane>
            <n-tab-pane v-if="openSettings.enableSendMail" name="user_send_mail" :tab="t('send_mail')">
                <UserSendBox mode="send_mail" @sent="userTab = 'user_sendbox'" />
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
