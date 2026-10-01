<script setup lang="ts">
import { computed } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import FilterEditor from './FilterEditor.vue'
import type { FilterExpression } from './filter'
import { webhookFilterFields, isWebhookFilterFieldAllowed, getWebhookFilterOperators } from './webhook-filter'

defineProps<{ modelValue?: FilterExpression | null }>()
const emit = defineEmits<{
    'update:modelValue': [value: FilterExpression | null]
    'validity-change': [valid: boolean]
}>()
const { t } = useScopedI18n('components.WebhookComponent')
const fields = computed(() => webhookFilterFields.map(value => ({ value, label: t(`filter_${value}`) })))
const operators = computed(() => getWebhookFilterOperators(t))
</script>

<template>
    <div style="width: 100%; min-width: 0">
        <FilterEditor :model-value="modelValue" :fields="fields" :operators="operators" allow-custom-fields
            :is-field-allowed="isWebhookFilterFieldAllowed" @update:model-value="emit('update:modelValue', $event)"
            @validity-change="emit('validity-change', $event)" />
        <n-text depth="3">{{ t('filterHelp') }}</n-text>
    </div>
</template>
