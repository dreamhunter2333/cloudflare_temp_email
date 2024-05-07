<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import MailBox from '../../components/MailBox.vue';

const {
    localeCache, adminAuth, showAdminAuth,
    adminMailTabAddress
} = useGlobalState()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            addressQueryTip: 'Leave blank to query all addresses',
            query: 'Query',
        },
        zh: {
            addressQueryTip: '留空查询所有地址',
            query: '查询',
        }
    }
});

const mailBoxKey = ref("")

const queryAddress = () => {
    mailBoxKey.value = adminMailTabAddress.value;
}

const fetchMailData = async (limit, offset) => {
    return await api.fetch(
        `/admin/mails`
        + `?limit=${limit}`
        + `&offset=${offset}`
        + (adminMailTabAddress.value ? `&address=${adminMailTabAddress.value}` : '')
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
    <div>
        <n-input-group>
            <n-input v-model:value="adminMailTabAddress" :placeholder="t('addressQueryTip')" />
            <n-button @click="queryAddress" type="primary" tertiary>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <MailBox :key="mailBoxKey" :enableUserDeleteEmail="false" :fetchMailData="fetchMailData" />
    </div>
</template>
