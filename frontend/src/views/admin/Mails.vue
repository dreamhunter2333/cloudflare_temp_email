<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { processItem } from '../../utils/email-parser'

const {
    localeCache, adminAuth, showAdminAuth,
    adminMailTabAddress
} = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            mails: 'Emails',
            itemCount: 'itemCount',
            query: 'Query',
        },
        zh: {
            mails: '邮件',
            itemCount: '总数',
            query: '查询',
        }
    }
});

const mailData = ref([])
const mailCount = ref(0)
const mailPage = ref(1)
const mailPageSize = ref(20)

watch([mailPage, mailPageSize, adminMailTabAddress], async () => {
    await fetchMailData()
})

const fetchMailData = async () => {
    if (!adminMailTabAddress.value) {
        return
    }
    try {
        const { results, count } = await api.fetch(
            `/admin/mails`
            + `?address=${adminMailTabAddress.value}`
            + `&limit=${mailPageSize.value}`
            + `&offset=${(mailPage.value - 1) * mailPageSize.value}`
        );
        mailData.value = await Promise.all(results.map(async (item) => {
            return await processItem(item);
        }));
        if (count > 0) {
            mailCount.value = count;
        }
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

onMounted(async () => {
    if (!adminAuth.value) {
        showAdminAuth.value = true;
        return;
    }
    await fetchMailData()
})
</script>

<template>
    <div>
        <n-input-group>
            <n-input v-model:value="adminMailTabAddress" />
            <n-button @click="fetchMailData" type="primary" ghost>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <n-list hoverable clickable>
            <div style="display: inline-block; margin-bottom: 10px;">
                <n-pagination v-model:page="mailPage" v-model:page-size="mailPageSize" :item-count="mailCount" simple>
                    <template #prefix="{ itemCount }">
                        {{ t('itemCount') }}: {{ itemCount }}
                    </template>
                </n-pagination>
            </div>
            <n-list-item v-for="row in mailData" v-bind:key="row.id">
                <n-thing class="center" :title="row.subject">
                    <template #description>
                        <n-space>
                            <n-tag type="info">
                                FROM: {{ row.source }}
                            </n-tag>
                            <n-tag type="info">
                                ID: {{ row.id }}
                            </n-tag>
                        </n-space>
                    </template>
                    <div v-html="row.message"></div>
                </n-thing>
            </n-list-item>
        </n-list>
    </div>
</template>

<style scoped>
.n-pagination {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>
