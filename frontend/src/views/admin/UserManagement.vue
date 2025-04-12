<script setup>
import { ref, h, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n'
import { NMenu, NButton, NBadge, NTag } from 'naive-ui';
import { MenuFilled } from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { hashPassword } from '../../utils';

import UserAddressManagement from './UserAddressManagement.vue'

const { loading, openSettings } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            success: 'Success',
            user_email: 'User Email',
            role: 'Role',
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
            changeRole: 'Change Role',
            prefix: 'Prefix',
            domains: 'Domains',
            roleDonotExist: 'Current Role does not exist',
            userAddressManagement: 'Address Management',
        },
        zh: {
            success: '成功',
            user_email: '用户邮箱',
            role: '角色',
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
            changeRole: '更改角色',
            prefix: '前缀',
            domains: '域名',
            roleDonotExist: '当前角色不存在',
            userAddressManagement: '地址管理',
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
const showChangeRole = ref(false)
const showUserAddressManagement = ref(false)
const userRoles = ref([])
const curUserRole = ref('')
const userRolesOptions = computed(() => {
    return userRoles.value.map(role => {
        return {
            label: role.role,
            value: role.role
        }
    });
})

const fetchUserRoles = async () => {
    try {
        const results = await api.fetch(`/admin/user_roles`);
        userRoles.value = results;
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const fetchData = async () => {
    try {
        userQuery.value = userQuery.value.trim()
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

const changeRole = async () => {
    try {
        await api.fetch(`/admin/user_roles`, {
            method: "POST",
            body: JSON.stringify({
                user_id: curUserId.value,
                role_text: curUserRole.value
            })
        });
        message.success(t('success'));
        showChangeRole.value = false;
        await fetchData();
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
        title: t('role'),
        key: "role_text",
        render(row) {
            if (!row.role_text) return null;
            return h(NTag, {
                bordered: false,
                type: "info"
            }, {
                default: () => row.role_text
            })
        }
    },
    {
        title: t('address_count'),
        key: "address_count",
        render(row) {
            return h(NButton,
                {
                    text: true,
                    onClick: () => {
                        if (row.address_count <= 0) return;
                        curUserId.value = row.id;
                        showUserAddressManagement.value = true;
                    }
                },
                {
                    icon: () => h(NBadge, {
                        value: row.address_count,
                        'show-zero': true,
                        max: 99,
                        type: "success"
                    }),
                    default: () => row.address_count > 0 ? t('userAddressManagement') : ""
                }
            )
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
                                                showUserAddressManagement.value = true;
                                            }
                                        },
                                        { default: () => t('userAddressManagement') }
                                    ),
                                    show: row.address_count > 0
                                },
                                {
                                    label: () => h(NButton,
                                        {
                                            text: true,
                                            onClick: () => {
                                                curUserId.value = row.id;
                                                curUserRole.value = row.role_text;
                                                showChangeRole.value = true;
                                            }
                                        },
                                        { default: () => t('changeRole') }
                                    ),
                                },
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

const getRolePrefix = (role) => {
    const res = userRoles.value.find(r => r.role === role)?.prefix;
    if (res === undefined || res === null) return openSettings.value.prefix;
    return res;
}

const getRoleDomains = (role) => {
    const res = userRoles.value.find(r => r.role === role)?.domains;
    if (res === undefined || res === null || res.length == 0) return openSettings.value.defaultDomains;
    return res;
}

const roleDonotExist = computed(() => {
    return curUserRole.value && !userRoles.value.some(r => r.role === curUserRole.value);
})

watch([page, pageSize], async () => {
    await fetchData()
})

onMounted(async () => {
    await fetchUserRoles();
    await fetchData();
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
        <n-modal v-model:show="showChangeRole" preset="dialog" :title="t('changeRole')">
            <n-alert type="error" :bordered="false" v-if="roleDonotExist">
                <span>{{ t('roleDonotExist') }}</span>
            </n-alert>
            <p>{{ t('prefix') + ": " + getRolePrefix(curUserRole) }}</p>
            <p>{{ t('domains') + ": " + JSON.stringify(getRoleDomains(curUserRole)) }}</p>
            <n-select clearable v-model:value="curUserRole" :options="userRolesOptions" />
            <template #action>
                <n-button :loading="loading" @click="changeRole" size="small" tertiary type="primary">
                    {{ t('changeRole') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showUserAddressManagement" preset="card" :title="t('userAddressManagement')">
            <UserAddressManagement :user_id="curUserId" />
        </n-modal>
        <n-input-group>
            <n-input v-model:value="userQuery" @keydown.enter="fetchData" />
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
    </div>
</template>

<style scoped>
.n-pagination {
    margin-top: 10px;
    margin-bottom: 10px;
}

.n-data-table {
    min-width: 800px;
}
</style>
