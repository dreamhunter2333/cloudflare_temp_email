<script setup>
import { onMounted, ref, watch } from 'vue';
import { useScopedI18n } from '@/i18n/app'

import { api } from '../../api'
import { useGlobalState } from '../../store'
import MailBox from '../../components/MailBox.vue';

const message = useMessage()
const { openSettings } = useGlobalState()

const { t } = useScopedI18n('views.user.UserMailBox')

const mailBoxKey = ref("")
const addressFilter = ref();
const addressFilterOptions = ref([]);

const queryMail = () => {
    addressFilter.value = addressFilter.value ? addressFilter.value.trim() : addressFilter.value;
    mailBoxKey.value = Date.now();
}

const fetchMailData = async (limit, offset) => {
    return await api.fetch(
        `/user_api/mails`
        + `?limit=${limit}`
        + `&offset=${offset}`
        + (addressFilter.value ? `&address=${addressFilter.value}` : '')
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
            <n-button @click="queryMail" type="primary" tertiary>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <div style="margin-top: 10px;"></div>
        <MailBox :key="mailBoxKey" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail" :fetchMailData="fetchMailData"
            :deleteMail="deleteMail" :showFilterInput="true" />
    </div>
</template>
