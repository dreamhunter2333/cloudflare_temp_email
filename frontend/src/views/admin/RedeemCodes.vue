<script setup>
import { computed, h, onMounted, ref, watch } from 'vue'
import { NButton, NEllipsis, NPopconfirm, NTag } from 'naive-ui'
import { useScopedI18n } from '@/i18n/app'

import { api } from '../../api'
import { useGlobalState } from '../../store'

const MAX_BATCH_SIZE = 500
const MAX_EXPORT_SIZE = 10000

const { loading, openSettings } = useGlobalState()
const { t } = useScopedI18n('views.admin.RedeemCodes')
const typeOptions = computed(() => [
    { label: t('typeRole'), value: 'role' },
    { label: t('typeBalance'), value: 'send_balance' },
    { label: t('typeAddress'), value: 'address_prefix_once' },
])
const message = useMessage()
const data = ref([])
const roleOptions = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)
const query = ref('')
const selectedType = ref('role')
const showEditor = ref(false)
const showExport = ref(false)
const editorMode = ref('create')
const exportType = ref('role')
const exportLimit = ref(1000)
const form = ref({})
const prefixMaxLength = computed(() => Math.max((openSettings.value.maxAddressLen || 30) - 1, 0))
let latestFetchRequest = 0

const resetForm = () => {
    form.value = {
        id: null,
        type: selectedType.value,
        count: 1,
        role: '',
        amount: 100,
        prefix: '',
        enabled: true,
        expires_at: null,
    }
}

const parseJson = (value) => {
    try {
        const parsed = JSON.parse(value || '{}')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
        return {}
    }
}

const parseDate = (value) => {
    if (!value) return null
    const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
}

const fetchData = async () => {
    const requestId = ++latestFetchRequest
    try {
        const result = await api.fetch(
            `/admin/redeem_codes?redeem_type=${encodeURIComponent(selectedType.value)}`
            + `&limit=${pageSize.value}&offset=${(page.value - 1) * pageSize.value}`
            + (query.value.trim() ? `&query=${encodeURIComponent(query.value.trim())}` : '')
        )
        if (requestId !== latestFetchRequest) return
        data.value = result.results || []
        count.value = result.count || 0
    } catch (error) {
        if (requestId !== latestFetchRequest) return
        message.error(error.message || 'error')
    }
}

const fetchRoleOptions = async () => {
    try {
        const [roles, config] = await Promise.all([
            api.fetch('/admin/user_roles'),
            api.fetch('/admin/worker/configs'),
        ])
        roleOptions.value = roles
            .filter((item) => item.role && item.role !== config.ADMIN_USER_ROLE)
            .map((item) => ({ label: item.role, value: item.role }))
    } catch (error) {
        message.error(error.message || 'error')
    }
}

const search = async () => {
    page.value = 1
    await fetchData()
}

const openCreate = () => {
    editorMode.value = 'create'
    resetForm()
    showEditor.value = true
}

const openEdit = (row) => {
    editorMode.value = 'edit'
    form.value = {
        id: row.id,
        type: selectedType.value,
        count: 1,
        role: selectedType.value === 'role' ? row.value : '',
        amount: selectedType.value === 'send_balance' ? Number(row.value) : null,
        prefix: selectedType.value === 'address_prefix_once' ? row.value : '',
        enabled: Boolean(row.enabled),
        expires_at: parseDate(row.expires_at)?.getTime() || null,
    }
    showEditor.value = true
}

const buildValue = () => {
    if (form.value.type === 'role') return form.value.role.trim()
    if (form.value.type === 'send_balance') return String(form.value.amount)
    return form.value.prefix.trim()
}

const save = async () => {
    if (form.value.type === 'role' && !form.value.role.trim()) {
        message.error(t('roleRequired'))
        return
    }
    const value = buildValue()
    if (form.value.type === 'address_prefix_once'
        && (!/^[a-z0-9]*$/i.test(value) || value.length > prefixMaxLength.value)
    ) {
        message.error(t('invalidPrefix', { max: prefixMaxLength.value }))
        return
    }
    if (!form.value.expires_at || form.value.expires_at <= Date.now()) {
        message.error(t('invalidExpiration'))
        return
    }
    try {
        if (editorMode.value === 'create') {
            if (!Number.isInteger(form.value.count)
                || form.value.count < 1
                || form.value.count > MAX_BATCH_SIZE
            ) {
                message.error(t('countLimit', { max: MAX_BATCH_SIZE }))
                return
            }
            const result = await api.fetch('/admin/redeem_codes/batch', {
                method: 'POST',
                body: JSON.stringify({
                    count: form.value.count,
                    redeem_type: form.value.type,
                    value,
                    enabled: form.value.enabled,
                    expires_at: new Date(form.value.expires_at).toISOString(),
                }),
            })
            downloadCreatedCodes(result.codes, {
                redeem_type: form.value.type,
                value,
                enabled: form.value.enabled,
                expires_at: new Date(form.value.expires_at).toISOString(),
            })
            message.success(t('createdResult', result))
        } else {
            await api.fetch(`/admin/redeem_codes/${form.value.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    redeem_type: form.value.type,
                    value,
                    enabled: form.value.enabled,
                    expires_at: new Date(form.value.expires_at).toISOString(),
                }),
            })
            message.success(t('saved'))
        }
        showEditor.value = false
        await fetchData()
    } catch (error) {
        message.error(error.message || 'error')
    }
}

const remove = async (id) => {
    try {
        await api.fetch(`/admin/redeem_codes/${id}`, { method: 'DELETE' })
        await fetchData()
    } catch (error) {
        message.error(error.message || 'error')
    }
}

const copyCode = async (code) => {
    try {
        await navigator.clipboard.writeText(code)
        message.success(t('copied'))
    } catch {
        message.error(t('copyFailed'))
    }
}

const download = (content, filename, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}

const csvCell = (value) => {
    let text = String(value ?? '')
    if (/^[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
}

const downloadCreatedCodes = (codes, fields) => {
    if (!Array.isArray(codes) || !codes.length) return
    const columns = ['code', 'redeem_type', 'value', 'enabled', 'expires_at']
    const csv = [
        columns.join(','),
        ...codes.map((code) => columns.map((column) => (
            csvCell(column === 'code' ? code : fields[column])
        )).join(',')),
    ].join('\n')
    download(`\uFEFF${csv}`, `redeem-codes-${fields.redeem_type}.csv`, 'text/csv;charset=utf-8')
}

const formatTime = (value) => parseDate(value)?.toLocaleString() || '-'

const exportList = async () => {
    try {
        const csv = await api.fetch(
            `/admin/redeem_codes/export?redeem_type=${encodeURIComponent(exportType.value)}`
            + `&limit=${exportLimit.value}`
        )
        download(csv, `redeem-codes-${exportType.value}.csv`, 'text/csv;charset=utf-8')
        showExport.value = false
    } catch (error) {
        message.error(error.message || 'error')
    }
}

const commonColumns = computed(() => [
    {
        title: t('code'),
        key: 'code',
        width: 180,
        render: (row) => h(NEllipsis, { style: 'max-width: 160px' }, { default: () => row.code }),
    },
])

const businessColumns = computed(() => {
    if (selectedType.value === 'role') {
        return [
            { title: t('role'), key: 'role', width: 140, render: (row) => row.value || '-' },
            {
                title: t('redeemedUser'),
                key: 'user',
                width: 240,
                render: (row) => parseJson(row.result).user_email || '-',
            },
        ]
    }
    if (selectedType.value === 'send_balance') {
        return [
            { title: t('amount'), key: 'amount', width: 140, render: (row) => row.value || '-' },
            {
                title: t('targetAddress'),
                key: 'address',
                width: 240,
                render: (row) => parseJson(row.result).address || '-',
            },
        ]
    }
    return [
        {
            title: t('prefix'),
            key: 'prefix',
            width: 160,
            render: (row) => row.value || t('emptyPrefix'),
        },
        {
            title: t('resultAddress'),
            key: 'address',
            width: 240,
            render: (row) => parseJson(row.result).address || '-',
        },
    ]
})

const columns = computed(() => [
    ...commonColumns.value,
    ...businessColumns.value,
    {
        title: t('enabled'),
        key: 'enabled',
        width: 90,
        render: (row) => h(NTag, { type: row.enabled ? 'success' : 'default', bordered: false }, {
            default: () => row.enabled ? t('yes') : t('no'),
        }),
    },
    {
        title: t('expiresAt'),
        key: 'expires_at',
        width: 260,
        render: (row) => {
            const expiration = parseDate(row.expires_at)
            const expired = !expiration || expiration.getTime() <= Date.now()
            return h('div', { class: 'expiration-cell' }, [
                h(NTag, { type: expired ? 'error' : 'success', size: 'small', bordered: false }, {
                    default: () => expired ? t('expired') : t('valid'),
                }),
                h('span', formatTime(row.expires_at)),
            ])
        },
    },
    { title: t('redeemedAt'), key: 'redeemed_at', width: 180, render: (row) => formatTime(row.redeemed_at) },
    {
        title: t('actions'),
        key: 'actions',
        width: 230,
        fixed: 'right',
        render: (row) => h('div', { class: 'actions' }, [
            h(NButton, { size: 'small', tertiary: true, onClick: () => copyCode(row.code) }, {
                default: () => t('copy'),
            }),
            row.redeemed
                ? null
                : h(NButton, { size: 'small', tertiary: true, onClick: () => openEdit(row) }, {
                    default: () => t('edit'),
                }),
            h(NPopconfirm, { onPositiveClick: () => remove(row.id) }, {
                trigger: () => h(NButton, { size: 'small', tertiary: true, type: 'error' }, {
                    default: () => t('delete'),
                }),
                default: () => t('deleteConfirm'),
            }),
        ]),
    },
])

watch([page, pageSize], fetchData)
watch(selectedType, async () => {
    page.value = 1
    await fetchData()
})
onMounted(async () => {
    await Promise.all([fetchData(), fetchRoleOptions()])
})
</script>

<template>
    <div class="redeem-admin">
        <div class="redeem-toolbar">
            <div class="redeem-filters">
                <n-input-group class="type-filter">
                    <n-input-group-label>{{ t('typeFilter') }}</n-input-group-label>
                    <n-select data-testid="redeem-admin-filter-type" v-model:value="selectedType"
                        :options="typeOptions" class="type-select" />
                </n-input-group>
                <n-input data-testid="redeem-admin-search" v-model:value="query"
                    :placeholder="t('searchPlaceholder')" class="search-input" @keyup.enter="search" />
                <n-button @click="search">{{ t('search') }}</n-button>
            </div>
            <div class="redeem-toolbar-actions">
                <n-button data-testid="redeem-admin-export" @click="exportType = selectedType; showExport = true">
                    {{ t('export') }}
                </n-button>
                <n-button data-testid="redeem-admin-create" type="primary" @click="openCreate">
                    {{ t('batchCreate') }}
                </n-button>
            </div>
        </div>

        <n-data-table :columns="columns" :data="data" :bordered="false" :scroll-x="1320" />
        <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count"
            :page-sizes="[20, 50, 100]" show-size-picker />

        <n-modal v-model:show="showEditor" preset="dialog"
            :title="editorMode === 'create' ? t('batchCreate') : t('edit')">
            <n-form label-placement="top">
                <n-form-item v-if="editorMode === 'edit'" :label="t('type')">
                    <n-select v-model:value="form.type" :options="typeOptions" disabled />
                </n-form-item>
                <n-form-item v-if="editorMode === 'create'" :label="t('generationCount')">
                    <n-input-number data-testid="redeem-admin-count" v-model:value="form.count"
                        :min="1" :max="MAX_BATCH_SIZE" :precision="0" />
                </n-form-item>
                <n-form-item v-if="form.type === 'role'" :label="t('role')" required>
                    <n-select data-testid="redeem-admin-role" v-model:value="form.role"
                        :options="roleOptions" filterable />
                </n-form-item>
                <n-form-item v-else-if="form.type === 'send_balance'" :label="t('amount')">
                    <n-input-number v-model:value="form.amount" :min="1" :max="1000000000" />
                </n-form-item>
                <n-form-item v-else :label="t('prefix')">
                    <n-input v-model:value="form.prefix" :maxlength="prefixMaxLength"
                        :placeholder="t('emptyPrefixTip')" />
                </n-form-item>
                <n-form-item :label="t('expiresAt')" required>
                    <n-date-picker v-model:value="form.expires_at" type="datetime" clearable />
                </n-form-item>
                <n-form-item :label="t('enabled')">
                    <n-switch v-model:value="form.enabled" />
                </n-form-item>
            </n-form>
            <template #action>
                <n-button :loading="loading" type="primary" @click="save">
                    {{ editorMode === 'create' ? t('generate') : t('save') }}
                </n-button>
            </template>
        </n-modal>

        <n-modal v-model:show="showExport" preset="dialog" :title="t('export')">
            <n-form label-placement="top">
                <n-form-item :label="t('exportLimit', { max: MAX_EXPORT_SIZE })">
                    <n-input-number v-model:value="exportLimit" :min="1" :max="MAX_EXPORT_SIZE" />
                </n-form-item>
            </n-form>
            <template #action>
                <n-button :loading="loading" type="primary" @click="exportList">{{ t('downloadCsv') }}</n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.redeem-admin {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    padding-top: 10px;
}

.redeem-toolbar,
.redeem-filters,
.redeem-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.redeem-toolbar,
.redeem-filters {
    flex-wrap: wrap;
    min-width: 0;
}

.redeem-toolbar {
    justify-content: space-between;
}

.redeem-filters {
    flex: 1 1 520px;
}

.type-select {
    flex: 1;
    min-width: 0;
}

.type-filter {
    flex: 1 1 300px;
    min-width: 240px;
}

.search-input {
    flex: 1 1 180px;
    min-width: 120px;
}

.redeem-toolbar-actions {
    margin-left: auto;
}

:deep(.actions) {
    display: flex;
    gap: 4px;
}

:deep(.expiration-cell) {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
}
</style>
