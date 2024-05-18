<script setup lang="ts">
import { ref, h, onMounted } from 'vue';
import { useStorage } from '@vueuse/core';
import { useI18n } from 'vue-i18n'
import { NPopconfirm, NButton } from 'naive-ui'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import { api } from '../../api'

const { localeCache, jwt, telegramApp } = useGlobalState()
// @ts-ignore
const message = useMessage()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            success: 'success',
            address: 'Address',
            actions: 'Actions',
            changeMailAddress: 'Change Mail Address',
        },
        zh: {
            success: '成功',
            address: '地址',
            actions: '操作',
            changeMailAddress: '切换邮箱地址',
        }
    }
});

const data = useStorage("telegram-bind-address", [])

const fetchData = async () => {
    try {
        data.value = await api.fetch(`/telegram/bind_address`, {
            method: 'POST',
            body: JSON.stringify({
                initData: telegramApp.value.initData
            })
        });
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const columns = [
    {
        title: t('address'),
        key: "address"
    },
    {
        title: t('actions'),
        key: 'actions',
        render(row: any) {
            return h('div', [
                h(NPopconfirm,
                    {
                        onPositiveClick: () => {
                            jwt.value = row.jwt
                            location.reload()
                        }
                    },
                    {
                        trigger: () => h(NButton,
                            {
                                tertiary: true,
                                type: "primary",
                            },
                            { default: () => t('changeMailAddress') }
                        ),
                        default: () => `${t('changeMailAddress')}?`
                    }
                )
            ])
        }
    }
]

onMounted(async () => {
    if (!telegramApp.value?.initData || data.value.length > 0) {
        return
    }
    await fetchData()
})
</script>

<template>
    <div>
        <n-data-table :columns="columns" :data="data" :bordered="false" />
    </div>
</template>
