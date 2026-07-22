<script setup>
import { ref, onMounted } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { useRoute, useRouter } from 'vue-router';

import { useGlobalState } from '../../store'
import { api } from '../../api';

const {
    userJwt, userOauth2SessionState, userOauth2SessionClientID
} = useGlobalState()

const message = useMessage();
const route = useRoute()
const router = useRouter()
const errorInfo = ref('')
const { t } = useScopedI18n('views.user.UserOauth2Callback')

onMounted(async () => {
    try {
        const state = route.query.state;
        if (state != userOauth2SessionState.value) {
            console.error('state not match');
            message.error(t('stateNotMatch'));
            return;
        }
        const code = route.query.code;
        if (!code) {
            console.error('code not found');
            message.error(t('codeNotFound'));
            return;
        }
        const res = await api.fetch(`/user_api/oauth2/callback`, {
            method: 'POST',
            body: JSON.stringify({
                code: code,
                clientID: userOauth2SessionClientID.value
            })
        });
        userJwt.value = res.jwt;
        router.push('/user');
    } catch (error) {
        console.error(error);
        message.error(error.message || 'error');
    } finally {
        userOauth2SessionState.value = '';
        userOauth2SessionClientID.value = '';
    }
});
</script>

<template>
    <n-card :bordered="false" embedded>
        <n-result status="info" :title="t('logging')" :description="errorInfo">
        </n-result>
    </n-card>
</template>
