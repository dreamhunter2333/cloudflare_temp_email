<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import MailBox from '../../components/MailBox.vue';

const { adminMailTabAddress } = useGlobalState()

const { t } = useI18n({
    messages: {
        en: {
            addressQueryTip: 'Leave blank to query all addresses',
            keywordQueryTip: 'Leave blank to not query by keyword',
            query: 'Query',
        },
        zh: {
            addressQueryTip: '留空查询所有地址',
            keywordQueryTip: '留空不按关键字查询',
            query: '查询',
        }
    }
});

const mailBoxKey = ref("")
const mailKeyword = ref("")

const queryMail = () => {
    adminMailTabAddress.value = adminMailTabAddress.value.trim();
    mailKeyword.value = mailKeyword.value.trim();
    mailBoxKey.value = Date.now();
}

const fetchMailData = async (limit, offset) => {
    return await api.fetch(
        `/admin/mails`
        + `?limit=${limit}`
        + `&offset=${offset}`
        + (adminMailTabAddress.value ? `&address=${adminMailTabAddress.value}` : '')
        + (mailKeyword.value ? `&keyword=${mailKeyword.value}` : '')
    );
}

const deleteMail = async (curMailId) => {
    await api.fetch(`/admin/mails/${curMailId}`, { method: 'DELETE' });
};
</script>

<template>
    <div style="margin-top: 10px;">
        <n-input-group>
            <n-input v-model:value="adminMailTabAddress" :placeholder="t('addressQueryTip')"
                @keydown.enter="queryMail" />
            <n-input v-model:value="mailKeyword" :placeholder="t('keywordQueryTip')" @keydown.enter="queryMail" />
            <n-button @click="queryMail" type="primary" tertiary>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <div style="margin-top: 10px;"></div>
        <MailBox :key="mailBoxKey" :enableUserDeleteEmail="true" :fetchMailData="fetchMailData"
            :deleteMail="deleteMail" />
    </div>
</template>
