<script setup>
import { onMounted, ref } from 'vue'
import { useAppI18n as useI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import Login from '../common/Login.vue'

const { userJwt, userSettings, } = useGlobalState()

const { t } = useI18n({
    messages: {
        en: {
            logout: 'Logout',
        },
        zh: {
            logout: '退出登录',
        }
    }
});

const fetchData = async () => {
}

onMounted(async () => {
    await fetchData()
})
</script>

<template>
    <div class="center" v-if="userSettings.user_email">
        <n-card :bordered="false" embedded style="max-width: 600px;">
            <Login />
        </n-card>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
}
</style>
