<script setup>
import { ref, h, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router';
import { NBadge, NPopconfirm, NButton } from 'naive-ui'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { getRouterPathWithLang } from '../../utils'

const { jwt } = useGlobalState()
const message = useMessage()
const router = useRouter()

const { locale, t } = useI18n({
    messages: {
        en: {
            success: 'success',
            name: 'Name',
            mail_count: 'Mail Count',
            send_count: 'Send Count',
            actions: 'Actions',
            changeMailAddress: 'Change Mail Address',
            unbindAddress: 'Unbind Address',
            unbindAddressTip: 'Before unbinding, please switch to this email address and save the email address credential.',
        },
        zh: {
            success: '成功',
            name: '名称',
            mail_count: '邮件数量',
            send_count: '发送数量',
            actions: '操作',
            changeMailAddress: '切换邮箱地址',
            unbindAddress: '解绑地址',
            unbindAddressTip: '解绑前请切换到此邮箱地址并保存邮箱地址凭证。',
        }
    }
});

const data = ref([])

const changeMailAddress = async (address_id) => {
    try {
        const res = await api.fetch(`/user_api/bind_address_jwt/${address_id}`);
        message.success(t('changeMailAddress') + " " + t('success'));
        if (!res.jwt) {
            message.error("jwt not found");
            return;
        }
        jwt.value = res.jwt;
        await router.push(getRouterPathWithLang("/", locale.value))
        location.reload();
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const unbindAddress = async (address_id) => {
    try {
        const res = await api.fetch(`/user_api/unbind_address`, {
            method: 'POST',
            body: JSON.stringify({ address_id })
        });
        message.success(t('unbindAddress') + " " + t('success'));
        await fetchData();
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const fetchData = async () => {
    try {
        const { results, count: addressCount } = await api.fetch(
            `/user_api/bind_address`
        );
        data.value = results;
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
    },
    {
        title: t('actions'),
        key: 'actions',
        render(row) {
            return h('div', [
                h(NPopconfirm,
                    {
                        onPositiveClick: () => changeMailAddress(row.id)
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
                ),
                h(NPopconfirm,
                    {
                        onPositiveClick: () => unbindAddress(row.id)
                    },
                    {
                        trigger: () => h(NButton,
                            {
                                tertiary: true,
                                type: "error",
                            },
                            { default: () => t('unbindAddress') }
                        ),
                        default: () => t('unbindAddressTip')
                    }
                ),
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
        <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
    </div>
</template>
