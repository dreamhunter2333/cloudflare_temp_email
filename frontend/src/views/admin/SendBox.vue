<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { localeCache, settings, adminAuth, adminSendBoxTabAddress } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            address: 'Address',
            success: 'Success',
            to_mail: 'To Mail',
            subject: 'Subject',
            created_at: 'Created At',
            action: 'Action',
            query: 'Query',
            itemCount: 'itemCount',
            view: 'View',
        },
        zh: {
            address: '地址',
            success: '成功',
            to_mail: '收件人邮箱',
            subject: '主题',
            created_at: '创建时间',
            action: '操作',
            query: '查询',
            itemCount: '总数',
            view: '查看',
        }
    }
});
const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const curRow = ref({})
const showModal = ref(false)

const fetchData = async () => {
    try {
        const { results, count: addressCount } = await api.fetch(
            `/admin/sendbox`
            + `?limit=${pageSize.value}`
            + `&offset=${(page.value - 1) * pageSize.value}`
            + (adminSendBoxTabAddress.value ? `&address=${adminSendBoxTabAddress.value}` : '')
        );
        data.value = results.map((item) => {
            try {
                const data = JSON.parse(item.raw);
                item.to_mail = data?.personalizations?.map(
                    (p) => p.to?.map((t) => t.email).join(',')
                ).join(';');
                item.subject = data.subject;
                item.raw = JSON.stringify(data, null, 2);
            } catch (error) {
                console.log(error);
            }
            return item;
        });
        if (addressCount > 0) {
            count.value = addressCount;
        }
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const columns = [
    {
        title: "ID",
        key: "id"
    },
    {
        title: t('address'),
        key: "address"
    },
    {
        title: t('to_mail'),
        key: "to_mail"
    },
    {
        title: t('subject'),
        key: "subject"
    },
    {
        title: t('created_at'),
        key: "created_at"
    },
    {
        title: t('action'),
        key: 'actions',
        render(row) {
            return h('div', [
                h(NButton,
                    {
                        type: 'success',
                        ghost: true,
                        onClick: () => {
                            showModal.value = true;
                            curRow.value = row;
                        }
                    },
                    { default: () => t('view') }
                )
            ])
        }
    }
]

watch([page, pageSize], async () => {
    await fetchData()
})

onMounted(async () => {
    if (!adminAuth.value) {
        showAdminAuth.value = true;
        return;
    }
    await fetchData()
})
</script>

<template>
    <div v-if="settings.address">
        <n-modal v-model:show="showModal" preset="dialog">
            <pre>{{ curRow.raw }}</pre>
        </n-modal>
        <n-input-group>
            <n-input v-model:value="adminSendBoxTabAddress" />
            <n-button @click="fetchData" type="primary" ghost>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <div style="display: inline-block;">
            <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count"
                :page-sizes="[20, 50, 100]" show-size-picker>
                <template #prefix="{ itemCount }">
                    {{ t('itemCount') }}: {{ itemCount }}
                </template>
            </n-pagination>
        </div>
        <n-data-table :columns="columns" :data="data" :bordered="false" />
    </div>
</template>

<style scoped>
.n-pagination {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>
