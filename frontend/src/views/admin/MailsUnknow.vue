<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { processItem } from '../../utils/email-parser'

const {
    localeCache, adminAuth, showAdminAuth
} = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            itemCount: 'itemCount',
            refresh: 'Refresh'
        },
        zh: {
            itemCount: '总数',
            refresh: '刷新'
        }
    }
});

const mailUnknowData = ref([])
const mailUnknowCount = ref(0)
const mailUnknowPage = ref(1)
const mailUnknowPageSize = ref(20)

watch([mailUnknowPage, mailUnknowPageSize], async () => {
    await fetchMailUnknowData()
})

const fetchMailUnknowData = async () => {
    try {
        const { results, count } = await api.fetch(
            `/admin/mails_unknow`
            + `?limit=${mailUnknowPageSize.value}`
            + `&offset=${(mailUnknowPage.value - 1) * mailUnknowPage.value}`
        );
        mailUnknowData.value = await Promise.all(results.map(async (item) => {
            return await processItem(item);
        }));
        if (count > 0) {
            mailUnknowCount.value = count;
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
    await fetchMailUnknowData();
})
</script>

<template>
    <div>
        <n-button @click="fetchMailUnknowData" type="primary" ghost>
            {{ t('refresh') }}
        </n-button>
        <n-list hoverable clickable>
            <div style="display: inline-block; margin-bottom: 10px;">
                <n-pagination v-model:page="mailUnknowPage" v-model:page-size="mailUnknowPageSize"
                    :item-count="mailUnknowCount" simple>
                    <template #prefix="{ itemCount }">
                        {{ t('itemCount') }}: {{ itemCount }}
                    </template>
                </n-pagination>
            </div>
            <n-list-item v-for="row in mailUnknowData" v-bind:key="row.id">
                <n-thing class="center" :title="row.subject">
                    <template #description>
                        <n-space>
                            <n-tag type="info">
                                FROM: {{ row.source }}
                            </n-tag>
                            <n-tag type="info">
                                ID: {{ row.id }}
                            </n-tag>
                            <n-tag type="info">
                                TO: {{ row.address }}
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
