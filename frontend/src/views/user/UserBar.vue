<script setup>
import { onMounted } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import UserLogin from './UserLogin.vue'

const message = useMessage()
const router = useRouter()

const {
    userSettings, userJwt, userOpenSettings
} = useGlobalState()

const { t } = useScopedI18n('views.user.UserBar')


onMounted(async () => {
    await api.getUserOpenSettings(message);
    // make sure user_id is fetched
    if (!userSettings.value.user_id) await api.getUserSettings(message);
});
</script>

<template>
    <div>
        <n-card :bordered="false" embedded v-if="!userSettings.fetched">
            <n-skeleton style="height: 50vh" />
        </n-card>
        <div v-else-if="userSettings.user_email">
            <n-alert type="success" :show-icon="false" :bordered="false">
                <span>
                    <b>{{ t('currentUser') }} <b>{{ userSettings.user_email }}</b></b>
                </span>
            </n-alert>
        </div>
        <div v-else class="center">
            <n-card :bordered="false" embedded style="max-width: 600px;">
                <n-alert v-if="userJwt" type="warning" :show-icon="false" :bordered="false" closable>
                    <span>{{ t('fetchUserSettingsError') }}</span>
                </n-alert>
                <UserLogin />
            </n-card>
        </div>
    </div>
</template>

<style scoped>
.n-alert {
    margin-top: 10px;
    margin-bottom: 10px;
    text-align: center;
}

.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
    margin: 20px;
}
</style>
