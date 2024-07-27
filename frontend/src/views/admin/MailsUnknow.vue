<script setup>
import { api } from '../../api'
import MailBox from '../../components/MailBox.vue';

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
</script>

<template>
    <div style="margin-top: 10px;">
        <MailBox :enableUserDeleteEmail="true" :fetchMailData="fetchMailUnknowData" :deleteMail="deleteMail" />
    </div>
</template>
