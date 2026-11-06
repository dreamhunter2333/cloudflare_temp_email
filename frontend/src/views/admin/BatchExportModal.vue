<script setup>
import { computed, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'

const props = defineProps({
    show: {
        type: Boolean,
        default: false,
    },
    rows: {
        type: Array,
        default: () => [],
    },
})

const emit = defineEmits(['update:show'])
const { t } = useScopedI18n('views.admin.BatchExportModal')

const modalShow = computed({
    get: () => props.show,
    set: (value) => emit('update:show', value),
})

const mode = ref('spreadsheet')

const quote = (value, spreadsheetSafe) => {
    let text = String(value)
    // Leading ' keeps spreadsheets from evaluating a cell (e.g. an =PREFIX address) as a formula.
    if (spreadsheetSafe) text = text.replace(/^[=+\-@\t\r]/, "'$&")
    return `"${text.replace(/"/g, '""')}"`
}

const download = () => {
    if (!props.rows.length) return
    const spreadsheetSafe = mode.value === 'spreadsheet'
    const rows = [['address', 'login_url'], ...props.rows.map(row => [
        row.address, `${window.location.origin}/?jwt=${encodeURIComponent(row.jwt)}`,
    ])]
    const csv = rows.map(row => row.map(value => quote(value, spreadsheetSafe)).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = spreadsheetSafe ? 'mailbox-login-links.csv' : 'mailbox-login-links-raw.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
    <n-modal v-model:show="modalShow" preset="card" :title="t('title')"
        style="width: min(560px, calc(100vw - 32px));">
        <n-radio-group v-model:value="mode">
            <n-space vertical>
                <n-radio value="spreadsheet">{{ t('spreadsheet') }}</n-radio>
                <n-text depth="3">{{ t('spreadsheetTip') }}</n-text>
                <n-radio value="raw">{{ t('raw') }}</n-radio>
                <n-text depth="3">{{ t('rawTip') }}</n-text>
            </n-space>
        </n-radio-group>
        <template #footer>
            <n-space justify="end">
                <n-button @click="modalShow = false">{{ t('close') }}</n-button>
                <n-button type="primary" :disabled="!rows.length" @click="download">
                    {{ t('download') }}
                </n-button>
            </n-space>
        </template>
    </n-modal>
</template>
