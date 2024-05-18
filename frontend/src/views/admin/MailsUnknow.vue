<script setup>
import { onMounted } from 'vue';

import { useGlobalState } from '../../store'
import { api } from '../../api'
import MailBox from '../../components/MailBox.vue';

const { adminAuth, showAdminAuth } = useGlobalState()

const fetchMailUnknowData = async (limit, offset) => {
    return await api.fetch(
        `/admin/mails_unknow`
        + `?limit=${limit}`
        + `&offset=${offset}`
    );
}

onMounted(async () => {
    if (!adminAuth.value) {
        showAdminAuth.value = true;
        return;
    }
})
</script>

<template>
    <div v-if="adminAuth" style="margin-top: 10px;">
        <MailBox :enableUserDeleteEmail="false" :fetchMailData="fetchMailUnknowData" />
    </div>
</template>
