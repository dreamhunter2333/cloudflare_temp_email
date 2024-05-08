<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import Login from '../index/Login.vue'

const { userJwt, localeCache, userSettings, } = useGlobalState()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
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
        <n-card style="max-width: 600px;">
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
