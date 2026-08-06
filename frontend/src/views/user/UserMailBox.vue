<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
const addressFilterLoading = ref(false);
let addressSearchTimer = null;

const queryMail = () => {
    addressFilter.value = addressFilter.value ? addressFilter.value.trim() : addressFilter.value;
    mailBoxKey.value = Date.now();
}

const fetchMailData = async (limit, offset) => {
    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
    });
    if (addressFilter.value) {
        params.set('address', addressFilter.value);
    }
    return await api.fetch(`/user_api/mails?${params.toString()}`);
}

const fetchAddressData = async (query = '') => {
    addressFilterLoading.value = true;
    try {
        const params = new URLSearchParams({
            limit: '100',
            offset: '0',
            with_counts: 'false',
            with_total: 'false',
        });
        if (query) {
            params.set('query', query);
        }
        const { results } = await api.fetch(`/user_api/bind_address?${params.toString()}`);
        addressFilterOptions.value = results.map((item) => {
            return {
                label: item.name,
                value: item.name
            }
        });
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    } finally {
        addressFilterLoading.value = false;
    }
}

const searchAddresses = (query) => {
    clearTimeout(addressSearchTimer);
    addressSearchTimer = setTimeout(() => {
        fetchAddressData(query.trim());
    }, 250);
}

const deleteMail = async (curMailId) => {
    await api.fetch(`/user_api/mails/${curMailId}`, { method: 'DELETE' });
};

watch(addressFilter, async (newValue) => {
    queryMail();
});

onMounted(() => {
    fetchAddressData();
});

onBeforeUnmount(() => {
    clearTimeout(addressSearchTimer);
})
</script>

<template>
    <div style="margin-top: 10px;">
        <n-input-group>
            <n-select v-model:value="addressFilter" :options="addressFilterOptions" clearable filterable remote
                :loading="addressFilterLoading" :placeholder="t('addressQueryTip')" @search="searchAddresses" />
            <n-button @click="queryMail" type="primary" tertiary>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <div style="margin-top: 10px;"></div>
        <MailBox :key="mailBoxKey" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail" :fetchMailData="fetchMailData"
            :deleteMail="deleteMail" :showFilterInput="true" />
    </div>
</template>
