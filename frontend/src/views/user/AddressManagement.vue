<script setup>
import { ref, h, onBeforeUnmount, onMounted, watch } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router';
import { NBadge, NPopconfirm, NButton } from 'naive-ui'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { getRouterPathWithLang } from '../../utils'

import Login from '../common/Login.vue';

const { jwt } = useGlobalState()
const message = useMessage()
const router = useRouter()

const { locale, t } = useScopedI18n('views.user.AddressManagement')

const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)
const addressQuery = ref('')
const tableLoading = ref(false)
const showTranferAddress = ref(false)
const currentAddress = ref("")
const currentAddressId = ref(0)
const targetUserEmail = ref('')
let fetchRequestId = 0

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

const transferAddress = async () => {
    if (!targetUserEmail.value) {
        message.error("targetUserEmail is required");
        return;
    }
    if (!currentAddressId.value) {
        message.error("currentAddressId is required");
        return;
    }
    try {
        const res = await api.fetch(`/user_api/transfer_address`, {
            method: 'POST',
            body: JSON.stringify({
                address_id: currentAddressId.value,
                target_user_email: targetUserEmail.value
            })
        });
        message.success(t('transferAddress') + " " + t('success'));
        await fetchData();
        showTranferAddress.value = false;
        currentAddressId.value = 0;
        currentAddress.value = "";
        targetUserEmail.value = "";
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const fetchData = async () => {
    const requestId = ++fetchRequestId;
    tableLoading.value = true;
    try {
        const params = new URLSearchParams({
            limit: String(pageSize.value),
            offset: String((page.value - 1) * pageSize.value),
            with_counts: 'true',
            with_total: 'true',
        });
        if (addressQuery.value) {
            params.set('query', addressQuery.value);
        }
        const response = await api.fetch(
            `/user_api/bind_address?${params.toString()}`
        );
        if (requestId !== fetchRequestId) return;
        const results = response.results || [];
        const hasServerPagination = Number.isInteger(response.count);
        const normalizedQuery = addressQuery.value.toLowerCase();
        const fallbackResults = hasServerPagination
            ? results
            : results.filter((row) => !normalizedQuery || row.name?.toLowerCase().includes(normalizedQuery));
        const addressCount = hasServerPagination ? response.count : fallbackResults.length;
        data.value = hasServerPagination
            ? results
            : fallbackResults.slice((page.value - 1) * pageSize.value, page.value * pageSize.value);
        count.value = addressCount;
        const lastPage = Math.max(1, Math.ceil(addressCount / pageSize.value));
        if (page.value > lastPage) {
            page.value = lastPage;
        }
    } catch (error) {
        if (requestId !== fetchRequestId) return;
        console.log(error)
        message.error(error.message || "error");
    } finally {
        if (requestId === fetchRequestId) {
            tableLoading.value = false;
        }
    }
}

const queryAddress = async () => {
    addressQuery.value = addressQuery.value.trim();
    if (page.value !== 1) {
        page.value = 1;
        return;
    }
    await fetchData();
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
                h(NButton,
                    {
                        tertiary: true,
                        type: "primary",
                        onClick: () => {
                            currentAddressId.value = row.id;
                            currentAddress.value = row.name;
                            showTranferAddress.value = true;
                        }
                    },
                    { default: () => t('transferAddress') }
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

watch([page, pageSize], async () => {
    await fetchData();
})

onBeforeUnmount(() => {
    fetchRequestId++;
})
</script>

<template>
    <div>
        <n-modal v-model:show="showTranferAddress" preset="dialog" :title="t('transferAddress')">
            <span>
                <p>{{ t("transferAddressTip") }}</p>
                <p>{{ t('transferAddress') + ": " + currentAddress }}</p>
                <n-input v-model:value="targetUserEmail" :placeholder="t('targetUserEmail')" />
            </span>
            <template #action>
                <n-button :loading="loading" @click="transferAddress" size="small" tertiary type="error">
                    {{ t('transferAddress') }}
                </n-button>
            </template>
        </n-modal>
        <n-tabs type="segment">
            <n-tab-pane name="address" :tab="t('address')">
                <n-input-group>
                    <n-input v-model:value="addressQuery" :placeholder="t('addressQueryTip')"
                        @keydown.enter="queryAddress" clearable />
                    <n-button @click="queryAddress" type="primary" tertiary>
                        {{ t('query') }}
                    </n-button>
                </n-input-group>
                <div class="address-table-scroll">
                    <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count"
                        :page-sizes="[20, 50, 100]" show-size-picker>
                        <template #prefix="{ itemCount }">
                            {{ t('itemCount') }}: {{ itemCount }}
                        </template>
                    </n-pagination>
                    <n-data-table :columns="columns" :data="data" :loading="tableLoading"
                        :bordered="false" embedded />
                </div>
            </n-tab-pane>
            <n-tab-pane name="create_or_bind" :tab="t('create_or_bind')">
                <Login />
            </n-tab-pane>
        </n-tabs>
    </div>
</template>

<style scoped>
.n-data-table {
    min-width: 640px;
}

.address-table-scroll {
    max-width: 100%;
    overflow-x: auto;
}

.n-pagination {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>
