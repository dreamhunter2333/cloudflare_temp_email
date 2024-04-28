<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { NBadge } from 'naive-ui'
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { NButton, NMenu } from 'naive-ui';
import { MenuFilled } from '@vicons/material'

const {
    localeCache, adminAuth, showAdminAuth, loading,
    adminTab, adminMailTabAddress, adminSendBoxTabAddress
} = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            name: 'Name',
            created_at: 'Created At',
            updated_at: 'Update At',
            mail_count: 'Mail Count',
            send_count: 'Send Count',
            showPass: 'Show Passwrod',
            password: 'Password',
            passwordTip: 'Please copy the password and you can use it to login to your email account.',
            delete: 'Delete',
            deleteTip: 'Are you sure to delete this email?',
            delteAccount: 'Delete Account',
            viewMails: 'View Mails',
            viewSendBox: 'View SendBox',
            itemCount: 'itemCount',
            query: 'Query',
            addressQueryTip: 'Leave blank to query all addresses',
            actions: 'Actions'
        },
        zh: {
            name: '名称',
            created_at: '创建时间',
            updated_at: '更新时间',
            mail_count: '邮件数量',
            send_count: '发送数量',
            showPass: '显示密码',
            password: '密码',
            passwordTip: '请复制密码，你可以使用它登录你的邮箱。',
            delete: '删除',
            deleteTip: '确定要删除这个邮箱吗？',
            delteAccount: '删除邮箱',
            viewMails: '查看邮件',
            viewSendBox: '查看发件箱',
            itemCount: '总数',
            query: '查询',
            addressQueryTip: '留空查询所有地址',
            actions: '操作',
        }
    }
});

const showEmailPassword = ref(false)
const curEmailPassword = ref("")
const curDeleteAddressId = ref(0);

const addressQuery = ref("")

const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)
const showDelteAccount = ref(false)

const showPassword = async (id) => {
    try {
        curEmailPassword.value = await api.adminShowPassword(id)
        showEmailPassword.value = true
    } catch (error) {
        message.error(error.message || "error");
        showEmailPassword.value = false
        curEmailPassword.value = ""
    }
}

const deleteEmail = async () => {
    try {
        await api.adminDeleteAddress(curDeleteAddressId.value)
        message.success("success");
        await fetchData()
    } catch (error) {
        message.error(error.message || "error");
        showDelteAccount.value = false
    }
}

const fetchData = async () => {
    try {
        const { results, count: addressCount } = await api.fetch(
            `/admin/address`
            + `?limit=${pageSize.value}`
            + `&offset=${(page.value - 1) * pageSize.value}`
            + (addressQuery.value ? `&query=${addressQuery.value}` : "")
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
        title: t('created_at'),
        key: "created_at"
    },
    {
        title: t('updated_at'),
        key: "updated_at"
    },
    {
        title: t('mail_count'),
        key: "mail_count",
        render(row) {
            return h(NButton,
                {
                    text: true,
                    onClick: () => {
                        if (row.mail_count > 0) {
                            adminMailTabAddress.value = row.name;
                            adminTab.value = "mails";
                        }
                    }
                },
                {
                    icon: () => h(NBadge, {
                        value: row.mail_count,
                        'show-zero': true,
                        max: 99,
                        type: "success"
                    }),
                    default: () => row.mail_count > 0 ? t('viewMails') : ""
                }
            )
        }
    },
    {
        title: t('send_count'),
        key: "send_count",
        render(row) {
            return h(NButton,
                {
                    text: true,
                    onClick: () => {
                        if (row.send_count > 0) {
                            adminSendBoxTabAddress.value = row.name;
                            adminTab.value = "sendBox";
                        }
                    }
                },
                {
                    icon: () => h(NBadge, {
                        value: row.send_count,
                        'show-zero': true,
                        max: 99,
                        type: "success"
                    }),
                    default: () => row.send_count > 0 ? t('viewSendBox') : ""
                }
            )
        }
    },
    {
        title: t('actions'),
        key: 'actions',
        render(row) {
            return h('div', [
                h(NMenu, {
                    mode: "horizontal",
                    options: [
                        {
                            label: t('actions'),
                            icon: () => h(MenuFilled),
                            key: "action",
                            children: [
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => showPassword(row.id)
                                        },
                                        { default: () => t('showPass') }
                                    ),
                                },
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => {
                                                adminMailTabAddress.value = row.name;
                                                adminTab.value = "mails";
                                            }
                                        },
                                        { default: () => t('viewMails') }
                                    )
                                },
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => {
                                                adminSendBoxTabAddress.value = row.name;
                                                adminTab.value = "sendBox";
                                            }
                                        },
                                        { default: () => t('viewSendBox') }
                                    )
                                },
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => {
                                                curDeleteAddressId.value = row.id;
                                                showDelteAccount.value = true;
                                            }
                                        },
                                        { default: () => t('delete') }
                                    )
                                }
                            ]
                        }
                    ]
                })
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
    <div>
        <n-modal v-model:show="showEmailPassword" preset="dialog" title="Dialog">
            <template #header>
                <div>{{ t("password") }}</div>
            </template>
            <span>
                <p>{{ t("passwordTip") }}</p>
            </span>
            <n-card>
                <b>{{ curEmailPassword }}</b>
            </n-card>
            <template #action>
            </template>
        </n-modal>
        <n-modal v-model:show="showDelteAccount" preset="dialog" :title="t('delteAccount')">
            <p>{{ t('deleteTip') }}</p>
            <template #action>
                <n-button :loading="loading" @click="deleteEmail" size="small" tertiary type="error">
                    {{ t('delteAccount') }}
                </n-button>
            </template>
        </n-modal>
        <n-input-group>
            <n-input v-model:value="addressQuery" clearable :placeholder="t('addressQueryTip')" />
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
