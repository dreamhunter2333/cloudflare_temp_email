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

const deleteMail = async (curMailId) => {
    await api.fetch(`/api/mails/${curMailId}`, { method: 'DELETE' });
};

onMounted(async () => {
    if (!adminAuth.value) {
        showAdminAuth.value = true;
        return;
    }
})
</script>

<template>
    <div v-if="adminAuth" style="margin-top: 10px;">
        <MailBox :enableUserDeleteEmail="true" :fetchMailData="fetchMailUnknowData" :deleteMail="deleteMail" />
    </div>
</template>
