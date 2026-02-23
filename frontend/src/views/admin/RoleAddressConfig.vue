<script setup>
import { ref, onMounted, h } from 'vue';
import { useI18n } from 'vue-i18n'
import { NInputNumber, NTag, NSpace, NButton } from 'naive-ui';

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            role: 'Role',
            maxAddressCount: 'Max Address Count',
            save: 'Save',
            successTip: 'Success',
            noRolesAvailable: 'No roles available in system config',
            roleConfigDesc: 'Configure maximum address count for each user role. Role-based limits take priority over global settings.',
            notConfigured: 'Not Configured (Use Global Settings)',
        },
        zh: {
            role: '角色',
            maxAddressCount: '最大地址数量',
            save: '保存',
            successTip: '成功',
            noRolesAvailable: '系统配置中没有可用的角色',
            roleConfigDesc: '为每个用户角色配置最大地址数量。角色配置优先于全局设置。',
            notConfigured: '未配置（使用全局设置）',
        }
    }
});

const systemRoles = ref([])
const tableData = ref([])

const fetchUserRoles = async () => {
    try {
        const results = await api.fetch(`/admin/user_roles`);
        systemRoles.value = results;
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const fetchRoleConfigs = async () => {
    try {
        const { configs } = await api.fetch(`/admin/role_address_config`);
        tableData.value = systemRoles.value.map(roleObj => ({
            role: roleObj.role,
            max_address_count: configs[roleObj.role]?.maxAddressCount ?? null,
        }));
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const saveConfig = async () => {
    try {
        // convert tableData to object with nested structure
        const configs = {};
        tableData.value.forEach(row => {
            if (row.max_address_count !== null && row.max_address_count !== undefined) {
                configs[row.role] = { maxAddressCount: row.max_address_count };
            }
        });

        await api.fetch(`/admin/role_address_config`, {
            method: 'POST',
            body: JSON.stringify({ configs })
        });
        message.success(t('successTip'));
        await fetchRoleConfigs();
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const columns = [
    {
        title: t('role'),
        key: 'role',
        width: 200,
        render(row) {
            return h(NTag, {
                type: 'info',
                bordered: false
            }, {
                default: () => row.role
            })
        }
    },
    {
        title: t('maxAddressCount'),
        key: 'max_address_count',
        render(row) {
            return h(NInputNumber, {
                value: row.max_address_count,
                min: 0,
                max: 999,
                clearable: true,
                placeholder: t('notConfigured'),
                style: 'width: 200px;',
                onUpdateValue: (value) => {
                    row.max_address_count = value;
                }
            })
        }
    }
]

onMounted(async () => {
    await fetchUserRoles();
    await fetchRoleConfigs();
})
</script>

<template>
    <div style="margin-top: 10px;">
        <n-alert type="info" :bordered="false" style="margin-bottom: 20px;">
            {{ t('roleConfigDesc') }}
        </n-alert>

        <n-alert v-if="systemRoles.length === 0" type="warning" :bordered="false">
            {{ t('noRolesAvailable') }}
        </n-alert>

        <div v-else>
            <n-space justify="end" style="margin-bottom: 12px;">
                <n-button :loading="loading" @click="saveConfig" type="primary">
                    {{ t('save') }}
                </n-button>
            </n-space>

            <n-data-table
                :columns="columns"
                :data="tableData"
                :bordered="false"
                embedded
            />
        </div>
    </div>
</template>

<style scoped>
.n-data-table {
    min-width: 600px;
}
</style>
