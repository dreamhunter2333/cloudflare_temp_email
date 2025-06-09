<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n'

import { api } from '../../api'
import MailBox from '../../components/MailBox.vue';


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
const addressFilter = ref();
const mailKeyword = ref("")
const addressFilterOptions = ref([]);

const queryMail = () => {
    addressFilter.value = addressFilter.value ? addressFilter.value.trim() : addressFilter.value;
    mailKeyword.value = mailKeyword.value.trim();
    mailBoxKey.value = Date.now();
}

const fetchMailData = async (limit, offset) => {
    return await api.fetch(
        `/user_api/mails`
        + `?limit=${limit}`
        + `&offset=${offset}`
        + (addressFilter.value ? `&address=${addressFilter.value}` : '')
        + (mailKeyword.value ? `&keyword=${mailKeyword.value}` : '')
    );
}

const fetchAddresData = async () => {
    try {
        const { results } = await api.fetch(
            `/user_api/bind_address`
        );
        addressFilterOptions.value = results.map((item) => {
            return {
                label: item.name,
                value: item.name
            }
        });
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const deleteMail = async (curMailId) => {
    await api.fetch(`/user_api/mails/${curMailId}`, { method: 'DELETE' });
};

watch(addressFilter, async (newValue) => {
    queryMail();
});

onMounted(() => {
    fetchAddresData();
});
</script>

<template>
    <div style="margin-top: 10px;">
        <n-input-group>
            <n-select v-model:value="addressFilter" :options="addressFilterOptions" clearable
                :placeholder="t('addressQueryTip')" />
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
