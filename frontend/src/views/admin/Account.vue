<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { NBadge } from 'naive-ui'
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { NButton, NMenu } from 'naive-ui';
import { MenuFilled } from '@vicons/material'

const {
    loading, adminTab,
    adminMailTabAddress, adminSendBoxTabAddress
} = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            name: 'Name',
            created_at: 'Created At',
            updated_at: 'Update At',
            mail_count: 'Mail Count',
            send_count: 'Send Count',
            showCredential: 'Show Mail Address Credential',
            addressCredential: 'Mail Address Credential',
            addressCredentialTip: 'Please copy the Mail Address Credential and you can use it to login to your email account.',
            delete: 'Delete',
            deleteTip: 'Are you sure to delete this email?',
            deleteAccount: 'Delete Account',
            viewMails: 'View Mails',
            viewSendBox: 'View SendBox',
            itemCount: 'itemCount',
            query: 'Query',
            addressQueryTip: 'Leave blank to query all addresses',
            clearInbox: 'Clear Inbox',
            clearSentItems: 'Clear Sent Items',
            clearInboxTip: 'Are you sure to clear inbox for this email?',
            clearSentItemsTip: 'Are you sure to clear sent items for this email?',
            actions: 'Actions',
            success: 'Success',
        },
        zh: {
            name: '名称',
            created_at: '创建时间',
            updated_at: '更新时间',
            mail_count: '邮件数量',
            send_count: '发送数量',
            showCredential: '查看邮箱地址凭证',
            addressCredential: '邮箱地址凭证',
            addressCredentialTip: '请复制邮箱地址凭证，你可以使用它登录你的邮箱。',
            delete: '删除',
            deleteTip: '确定要删除这个邮箱吗？',
            deleteAccount: '删除邮箱',
            viewMails: '查看邮件',
            viewSendBox: '查看发件箱',
            itemCount: '总数',
            query: '查询',
            addressQueryTip: '留空查询所有地址',
            clearInbox: '清空收件箱',
            clearSentItems: '清空发件箱',
            clearInboxTip: '确定要清空这个邮箱的收件箱吗？',
            clearSentItemsTip: '确定要清空这个邮箱的发件箱吗？',
            actions: '操作',
            success: '成功',
        }
    }
});

const showEmailCredential = ref(false)
const curEmailCredential = ref("")
const curDeleteAddressId = ref(0);
const curClearInboxAddressId = ref(0);
const curClearSentItemsAddressId = ref(0);

const addressQuery = ref("")

const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)
const showDeleteAccount = ref(false)
const showClearInbox = ref(false)
const showClearSentItems = ref(false)

const showCredential = async (id) => {
    try {
        curEmailCredential.value = await api.adminShowAddressCredential(id)
        showEmailCredential.value = true
    } catch (error) {
        message.error(error.message || "error");
        showEmailCredential.value = false
        curEmailCredential.value = ""
    }
}

const deleteEmail = async () => {
    try {
        await api.adminDeleteAddress(curDeleteAddressId.value)
        message.success(t("success"));
        await fetchData()
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        showDeleteAccount.value = false
    }
}

const clearInbox = async () => {
    try {
        await api.fetch(`/admin/clear_inbox/${curClearInboxAddressId.value}`, {
            method: 'DELETE'
        });
        message.success(t("success"));
        await fetchData()
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        showClearInbox.value = false
    }
}

const clearSentItems = async () => {
    try {
        await api.fetch(`/admin/clear_sent_items/${curClearSentItemsAddressId.value}`, {
            method: 'DELETE'
        });
        message.success(t("success"));
        await fetchData()
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        showClearSentItems.value = false
    }
}

const fetchData = async () => {
    try {
        addressQuery.value = addressQuery.value.trim()
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
                                            onClick: () => showCredential(row.id)
                                        },
                                        { default: () => t('showCredential') }
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
                                    ),
                                    show: row.mail_count > 0
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
                                    ),
                                    show: row.send_count > 0
                                },
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => {
                                                curClearInboxAddressId.value = row.id;
                                                showClearInbox.value = true;
                                            }
                                        },
                                        { default: () => t('clearInbox') }
                                    ),
                                    show: row.mail_count > 0
                                },
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => {
                                                curClearSentItemsAddressId.value = row.id;
                                                showClearSentItems.value = true;
                                            }
                                        },
                                        { default: () => t('clearSentItems') }
                                    ),
                                    show: row.send_count > 0
                                },
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => {
                                                curDeleteAddressId.value = row.id;
                                                showDeleteAccount.value = true;
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
    await fetchData()
})
</script>

<template>
    <div style="margin-top: 10px;">
        <n-modal v-model:show="showEmailCredential" preset="dialog" title="Dialog">
            <template #header>
                <div>{{ t("addressCredential") }}</div>
            </template>
            <span>
                <p>{{ t("addressCredentialTip") }}</p>
            </span>
            <n-card :bordered="false" embedded>
                <b>{{ curEmailCredential }}</b>
            </n-card>
            <template #action>
            </template>
        </n-modal>
        <n-modal v-model:show="showDeleteAccount" preset="dialog" :title="t('deleteAccount')">
            <p>{{ t('deleteTip') }}</p>
            <template #action>
                <n-button :loading="loading" @click="deleteEmail" size="small" tertiary type="error">
                    {{ t('deleteAccount') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showClearInbox" preset="dialog" :title="t('clearInbox')">
            <p>{{ t('clearInboxTip') }}</p>
            <template #action>
                <n-button :loading="loading" @click="clearInbox" size="small" tertiary type="error">
                    {{ t('clearInbox') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showClearSentItems" preset="dialog" :title="t('clearSentItems')">
            <p>{{ t('clearSentItemsTip') }}</p>
            <template #action>
                <n-button :loading="loading" @click="clearSentItems" size="small" tertiary type="error">
                    {{ t('clearSentItems') }}
                </n-button>
            </template>
        </n-modal>
        <n-input-group>
            <n-input v-model:value="addressQuery" clearable :placeholder="t('addressQueryTip')"
                @keydown.enter="fetchData" />
            <n-button @click="fetchData" type="primary" tertiary>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <div style="overflow: auto;">
            <div style="display: inline-block;">
                <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count"
                    :page-sizes="[20, 50, 100]" show-size-picker>
                    <template #prefix="{ itemCount }">
                        {{ t('itemCount') }}: {{ itemCount }}
                    </template>
                </n-pagination>
            </div>
            <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
        </div>
    </div>
</template>

<style scoped>
.n-pagination {
    margin-top: 10px;
    margin-bottom: 10px;
}

.n-data-table {
    min-width: 1000px;
}
</style>
