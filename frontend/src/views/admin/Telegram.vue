<script setup>
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { localeCache } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            init: 'Init',
            successTip: 'Success',
            status: 'Check Status',
        },
        zh: {
            init: '初始化',
            successTip: '成功',
            status: '查看状态',
        }
    }
});

const status = ref({
    fetched: false,
})

const fetchData = async () => {
    try {
        const res = await api.fetch(`/admin/telegram/status`)
        Object.assign(status.value, res)
        status.value.fetched = true
    } catch (error) {
        message.error(error.message || "error");
    }
}

const save = async () => {
    try {
        await api.fetch(`/admin/telegram/init`, {
            method: 'POST',
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error(error.message || "error");
    }
}
</script>

<template>
    <div class="center">
        <n-card style="max-width: 800px; overflow: auto;">
            <n-button @click="save" type="primary" block>
                {{ t('init') }}
            </n-button>
            <n-button @click="fetchData" secondary block>
                {{ t('status') }}
            </n-button>
            <pre v-if="status.fetched">{{ JSON.stringify(status, null, 2) }}</pre>
        </n-card>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
}

.n-button {
    margin-top: 10px;
}
</style>
