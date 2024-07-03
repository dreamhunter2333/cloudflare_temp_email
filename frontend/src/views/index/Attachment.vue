<script setup>
import { ref, h, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'

import { api } from '../../api'

const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            download: 'Download',
            action: 'Action',
        },
        zh: {
            download: '下载',
            action: '操作',
        }
    }
});
const data = ref([])
const showDownload = ref(false)
const curRow = ref({})
const curDownloadUrl = ref('')

const fetchData = async () => {
    try {
        const { results } = await api.fetch(
            `/api/attachment/list`
        );
        data.value = results;
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const columns = [
    {
        title: "key",
        key: "key"
    },
    {
        title: t('action'),
        key: 'actions',
        render(row) {
            return h('div', [
                h(NButton,
                    {
                        type: 'success',
                        tertiary: true,
                        onClick: async () => {
                            try {
                                const { url } = await api.fetch(`/api/attachment/get_url`, {
                                    method: 'POST',
                                    body: JSON.stringify({ key: row.key })
                                });
                                curDownloadUrl.value = url;
                                curRow.value = row;
                                showDownload.value = true;
                            }
                            catch (error) {
                                console.error(error);
                                message.error(error.message || "error");
                            }
                        }
                    },
                    { default: () => t('download') }
                )
            ])
        }
    }
]

onMounted(async () => {
    await fetchData()
})
</script>

<template>
    <div>
        <n-modal v-model:show="showDownload" preset="dialog" :title="t('download')">
            <n-tag type="info">{{ curRow.key }}</n-tag>
            <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="curRow.key.replace('/', '_')"
                :href="curDownloadUrl">
                {{ t('download') }}
            </n-button>
        </n-modal>
        <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
    </div>
</template>
