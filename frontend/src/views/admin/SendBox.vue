<script setup>
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import SendBox from '../../components/SendBox.vue';

const { adminSendBoxTabAddress } = useGlobalState()

const { t } = useI18n({
    messages: {
        en: {
            query: 'Query',
            queryTip: 'Please input address to query, leave blank to query all',
        },
        zh: {
            query: '查询',
            queryTip: '请输入地址查询, 留空则查询所有',
        }
    }
});

const fetchData = async (limit, offset) => {
    adminSendBoxTabAddress.value = adminSendBoxTabAddress.value.trim();
    return await api.fetch(
        `/admin/sendbox?limit=${limit}&offset=${offset}`
        + (adminSendBoxTabAddress.value ? `&address=${adminSendBoxTabAddress.value}` : '')
    );
}

const deleteSenboxMail = async (curMailId) => {
    await api.fetch(`/admin/sendbox/${curMailId}`, { method: 'DELETE' });
};
</script>

<template>
    <div>
        <n-input-group>
            <n-input v-model:value="adminSendBoxTabAddress" :placeholder="t('queryTip')" @keydown.enter="fetchData" />
            <n-button @click="fetchData" type="primary" tertiary>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <SendBox style="margin-top: 10px;" :enableUserDeleteEmail="true" :deleteMail="deleteSenboxMail"
            :fetchMailData="fetchData" :showEMailFrom="true" />
    </div>
</template>

<style scoped>
.n-pagination {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>
