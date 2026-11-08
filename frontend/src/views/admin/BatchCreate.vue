<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { api } from '../../api'
import BatchExportModal from './BatchExportModal.vue'

const props = defineProps({
    options: { type: Object, required: true },
    addressRegex: { type: RegExp, required: true },
    disabled: Boolean,
})
const emit = defineEmits(['busy'])
const { t } = useScopedI18n('views.admin.BatchCreate')
const message = useMessage()
const busy = ref(false)
const batchCount = ref(10)
const batchRows = ref([])
const batchCompleted = ref(0)
const batchRequested = ref(0)
const batchError = ref('')
const showExportModal = ref(false)
let unmounted = false
onBeforeUnmount(() => { unmounted = true })

const validBatchCount = computed(() => Number.isInteger(batchCount.value)
    && batchCount.value >= 1 && batchCount.value <= 100)

const createBatch = async () => {
    if (busy.value || props.disabled) return
    if (!validBatchCount.value) {
        message.error(t('batchValidation'))
        return
    }
    const count = batchCount.value
    const options = { ...props.options }
    const normalization = props.addressRegex
    batchCompleted.value = 0
    batchRequested.value = count
    batchError.value = ''
    busy.value = true
    emit('busy', true)
    try {
        for (let i = 0; i < count && !unmounted; i++) {
            const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
            const name = Array.from(crypto.getRandomValues(new Uint8Array(30)),
                byte => alphabet[byte % alphabet.length]).join('')
                .replace(normalization, '').slice(0, 30)
            if (!name || !/^[a-z0-9]{1,30}$/.test(name)) {
                throw new Error(t('batchNameError'))
            }
            const res = await api.fetch('/admin/new_address', {
                method: 'POST',
                body: JSON.stringify({ ...options, name }),
                showLoading: false,
            })
            if (unmounted) break
            batchRows.value.push({ address: res.address, jwt: res.jwt })
            batchCompleted.value++
        }
    } catch (error) {
        if (!unmounted) batchError.value = error.message || 'error'
    } finally {
        busy.value = false
        if (!unmounted) emit('busy', false)
    }
}

const clearBatch = () => {
    if (busy.value) return
    batchRows.value = []
    batchCompleted.value = 0
    batchRequested.value = 0
    batchError.value = ''
}
</script>

<template>
    <div>
        <BatchExportModal v-model:show="showExportModal" :rows="batchRows" />
        <n-form-item-row :label="t('batchCount')" :feedback="t('randomNameTip')">
            <n-input-number v-model:value="batchCount" :disabled="busy || disabled" :show-button="false"
                :input-props="{ 'aria-label': t('batchCount') }" style="width: 100%;" />
        </n-form-item-row>
        <n-button @click="createBatch" type="primary" block :loading="busy"
            :disabled="busy || disabled || !validBatchCount">
            {{ t('createBatch') }}
        </n-button>
        <p>{{ t('batchProgress', { completed: batchCompleted, requested: batchRequested }) }}</p>
        <n-alert v-if="batchError" type="error" style="margin-bottom: 12px;">
            {{ t('batchStopped') }} {{ batchError }}
        </n-alert>
        <n-space>
            <n-button @click="showExportModal = true" :disabled="busy || !batchRows.length">{{ t('exportCsv') }}</n-button>
            <n-button @click="clearBatch" :disabled="busy || !batchRows.length">{{ t('clearResults') }}</n-button>
        </n-space>
        <p>{{ t('batchTotal', { count: batchRows.length }) }}</p>
        <p>{{ t('batchSecurity') }}</p>
    </div>
</template>
