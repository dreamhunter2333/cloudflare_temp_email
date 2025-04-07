<script setup>
import { ref, h, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'
import { NBadge } from 'naive-ui'

import { api } from '../../api'

const props = defineProps({
    user_id: {
        type: Number,
        required: true
    }
});

const message = useMessage()

const { locale, t } = useI18n({
    messages: {
        en: {
            success: 'success',
            name: 'Name',
            mail_count: 'Mail Count',
            send_count: 'Send Count',
        },
        zh: {
            success: '成功',
            name: '名称',
            mail_count: '邮件数量',
            send_count: '发送数量',
        }
    }
});

const data = ref([])

const fetchData = async () => {
    try {
        const { results } = await api.fetch(
            `/admin/users/bind_address/${props.user_id}`,
        );
        data.value = results;
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const columns = [
    {
        title: t('name'),
        key: "name"
    },
    {
        title: t('mail_count'),
        key: "mail_count",
        render(row) {
            return h(NBadge, {
                value: row.mail_count,
                'show-zero': true,
                max: 99,
                type: "success"
            })
        }
    },
    {
        title: t('send_count'),
        key: "send_count",
        render(row) {
            return h(NBadge, {
                value: row.send_count,
                'show-zero': true,
                max: 99,
                type: "success"
            })
        }
    }
]

onMounted(async () => {
    await fetchData()
})
</script>

<template>
    <div style="overflow: auto;">
        <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
    </div>
</template>

<style scoped>
.n-data-table {
    min-width: 700px;
}
</style>
