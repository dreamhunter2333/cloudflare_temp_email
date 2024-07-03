<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'
import { NMenu, NButton, NBadge } from 'naive-ui';
import { MenuFilled } from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { hashPassword } from '../../utils';

const { loading } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            success: 'Success',
            user_email: 'User Email',
            address_count: 'Address Count',
            created_at: 'Created At',
            actions: 'Actions',
            query: 'Query',
            itemCount: 'itemCount',
            deleteUser: 'Delete User',
            delete: 'Delete',
            deleteUserTip: 'Are you sure you want to delete this user?',
            resetPassword: 'Reset Password',
            pleaseInput: 'Please input complete information',
            createUser: 'Create User',
            email: 'Email',
            password: 'Password',
        },
        zh: {
            success: '成功',
            user_email: '用户邮箱',
            address_count: '地址数量',
            created_at: '创建时间',
            actions: '操作',
            query: '查询',
            itemCount: '总数',
            deleteUser: '删除用户',
            delete: '删除',
            deleteUserTip: '确定要删除此用户吗？',
            resetPassword: '重置密码',
            pleaseInput: '请输入完整信息',
            createUser: '创建用户',
            email: '邮箱',
            password: '密码',
        }
    }
});
const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const userQuery = ref('')
const showResetPassword = ref(false)
const newResetPassword = ref('')
const showDeleteUser = ref(false)
const curUserId = ref(0)
const showCreateUser = ref(false)
const user = ref({
    email: "",
    password: ""
})

const fetchData = async () => {
    try {
        const { results, count: userCount } = await api.fetch(
            `/admin/users`
            + `?limit=${pageSize.value}`
            + `&offset=${(page.value - 1) * pageSize.value}`
            + (userQuery.value ? `&query=${userQuery.value}` : '')
        );
        data.value = results;
        if (userCount > 0) {
            count.value = userCount;
        }
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const resetPassword = async () => {
    if (!newResetPassword.value) {
        message.error(t('pleaseInput'));
        return;
    }
    try {
        await api.fetch(`/admin/users/${curUserId.value}/reset_password`, {
            method: "POST",
            body: JSON.stringify({
                password: await hashPassword(newResetPassword.value)
            })
        });
        message.success(t('success'));
        showResetPassword.value = false;
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const createUser = async () => {
    if (!user.value.email || !user.value.password) {
        message.error(t('pleaseInput'));
        return;
    }
    try {
        await api.fetch(`/admin/users`, {
            method: "POST",
            body: JSON.stringify({
                email: user.value.email,
                password: await hashPassword(user.value.password)
            })
        });
        message.success(t('success'));
        await fetchData();
        showCreateUser.value = false;
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const deleteUser = async () => {
    try {
        await api.fetch(`/admin/users/${curUserId.value}`, {
            method: "DELETE"
        });
        message.success(t('success'));
        showDeleteUser.value = false;
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
        title: t('user_email'),
        key: "user_email"
    },
    {
        title: t('address_count'),
        key: "address_count",
        render(row) {
            return h(NBadge, {
                value: row.address_count,
                'show-zero': true,
                max: 99,
                type: "success"
            })
        }
    },
    {
        title: t('created_at'),
        key: "created_at"
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
                                            onClick: () => {
                                                curUserId.value = row.id;
                                                newResetPassword.value = '';
                                                showResetPassword.value = true;
                                            }
                                        },
                                        { default: () => t('resetPassword') }
                                    ),
                                },
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => {
                                                curUserId.value = row.id;
                                                user.value.email = '';
                                                user.value.password = '';
                                                showDeleteUser.value = true;
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
        <n-modal v-model:show="showCreateUser" preset="dialog" :title="t('createUser')">
            <n-form>
                <n-form-item-row :label="t('email')" required>
                    <n-input v-model:value="user.email" />
                </n-form-item-row>
                <n-form-item-row :label="t('password')" required>
                    <n-input v-model:value="user.password" type="password" show-password-on="click" />
                </n-form-item-row>
            </n-form>
            <template #action>
                <n-button :loading="loading" @click="createUser" size="small" tertiary type="primary">
                    {{ t('createUser') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showResetPassword" preset="dialog" :title="t('resetPassword')">
            <n-form-item-row :label="t('password')" required>
                <n-input v-model:value="newResetPassword" type="password" show-password-on="click" />
            </n-form-item-row>
            <template #action>
                <n-button :loading="loading" @click="resetPassword" size="small" tertiary type="primary">
                    {{ t('resetPassword') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showDeleteUser" preset="dialog" :title="t('deleteUser')">
            <p>{{ t('deleteUserTip') }}</p>
            <template #action>
                <n-button :loading="loading" @click="deleteUser" size="small" tertiary type="error">
                    {{ t('deleteUser') }}
                </n-button>
            </template>
        </n-modal>
        <n-input-group>
            <n-input v-model:value="userQuery" />
            <n-button @click="fetchData" type="primary" tertiary>
                {{ t('query') }}
            </n-button>
        </n-input-group>
        <div style="display: inline-block;">
            <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count"
                :page-sizes="[20, 50, 100]" show-size-picker>
                <template #prefix="{ itemCount }">
                    {{ t('itemCount') }}: {{ itemCount }}
                </template>
                <template #suffix>
                    <n-button @click="showCreateUser = true" size="small" tertiary type="primary"
                        style="margin-left: 10px">
                        {{ t('createUser') }}
                    </n-button>
                </template>
            </n-pagination>
        </div>
        <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
    </div>
</template>

<style scoped>
.n-pagination {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>
