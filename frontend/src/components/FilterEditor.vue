<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { isValidFilterExpression, type FilterExpression, type FilterField, type FilterOperator } from '@/utils/filter'

const props = withDefaults(defineProps<{
    modelValue?: FilterExpression | null
    fields: FilterField[]
    operators: FilterOperator[]
    allowCustomFields?: boolean
    isFieldAllowed?: (field: string) => boolean
    depth?: number
}>(), { depth: 1, allowCustomFields: false })
const emit = defineEmits<{
    'update:modelValue': [value: FilterExpression | null]
    'validity-change': [valid: boolean]
}>()
const { t } = useScopedI18n('components.FilterEditor')
const mode = ref('visual')
const json = ref('')
const jsonError = ref(false)
const model = computed(() => props.modelValue)
const validate = (value: unknown) => isValidFilterExpression(value, props.operators,
    field => props.isFieldAllowed ? props.isFieldAllowed(field) : props.fields.some(item => item.value === field))
const rulesValid = computed(() => props.depth > 1 || validate(model.value))
const group = computed(() => !!model.value && ['and', 'or', 'not'].includes(model.value.operator))
const nodeType = computed(() => !model.value ? null : group.value ? model.value.operator : 'condition')
const nodeOptions = computed(() => ['condition', 'and', 'or', 'not'].map(value => ({
    label: t(value), value, disabled: props.depth >= 8 && value !== 'condition',
})))
const operatorOptions = computed(() => props.operators.find(item => item.value === model.value?.operator)?.options || [])
const update = (value: FilterExpression | null) => emit('update:modelValue', value)
const patch = (value: Partial<FilterExpression>) => update({ ...model.value!, ...value })
const setOperator = (operator: string) => update({ field: model.value?.field, operator, value: model.value?.value || '' })
const setOption = (key: string, value: unknown) => patch({ options: { ...model.value?.options, [key]: value } })
const changeType = (type: string) => {
    if (type === nodeType.value) return
    if (type === 'condition') {
        update({ field: '', operator: '', value: '' })
        return
    }
    const children = ['and', 'or'].includes(type) && ['and', 'or'].includes(nodeType.value || '')
        ? model.value!.children : Array(type === 'not' ? 1 : 2).fill(null)
    update({ operator: type, children })
}
const updateChild = (index: number, value: FilterExpression | null) => {
    const children = [...(model.value?.children || [])]
    children[index] = value
    patch({ children })
}
const changeMode = (value: string) => {
    mode.value = value
    json.value = JSON.stringify(model.value ?? null, null, 2)
}
const editJson = (value: string) => {
    json.value = value
    try {
        const parsed = JSON.parse(value)
        if (!validate(parsed)) throw new Error('Invalid expression')
        jsonError.value = false
        update(parsed)
    } catch {
        jsonError.value = true
    }
}
watch([rulesValid, jsonError], ([valid, error]) => emit('validity-change', valid && !error), { immediate: true })
</script>

<template>
    <div class="filter-editor" :class="{ nested: depth > 1 }" data-testid="filter-editor">
        <n-flex v-if="depth === 1" justify="space-between" align="center" class="editor-toolbar">
            <n-text depth="3">{{ t('hint') }}</n-text>
            <n-radio-group :value="mode" size="small" @update:value="changeMode">
                <n-radio-button value="visual" :disabled="jsonError">{{ t('visual') }}</n-radio-button>
                <n-radio-button value="json">JSON</n-radio-button>
            </n-radio-group>
        </n-flex>
        <template v-if="depth === 1 && mode === 'json'">
            <n-input :value="json" type="textarea" :autosize="{ minRows: 8, maxRows: 24 }"
                :status="jsonError ? 'error' : undefined" :input-props="{ 'aria-label': 'JSON' }" @update:value="editJson" />
            <n-text v-if="jsonError" type="error">{{ t('invalid') }}</n-text>
        </template>
        <n-alert v-else-if="depth > 8" type="error">{{ t('invalid') }}</n-alert>
        <template v-else>
            <n-text v-if="!rulesValid" type="error">{{ t('invalid') }}</n-text>
            <n-flex align="center" :wrap="true" class="node-toolbar">
                <n-select class="group-select" :value="nodeType" :options="nodeOptions" :placeholder="t('logic')"
                    :aria-label="t('logic')" @update:value="changeType" />
                <n-button v-if="model" size="small" quaternary type="error" @click="update(null)">{{ t('remove') }}</n-button>
            </n-flex>
            <template v-if="group">
                <FilterEditor v-for="(child, index) in model.children" :key="index"
                    :model-value="child" :fields="fields" :operators="operators" :depth="depth + 1"
                    :allow-custom-fields="allowCustomFields" :is-field-allowed="isFieldAllowed"
                    @update:model-value="updateChild(index, $event)" />
            </template>
            <template v-else-if="model">
                <div class="condition-inputs">
                    <n-select :value="model.field" :options="fields" filterable :tag="allowCustomFields"
                        :aria-label="t('field')" :placeholder="t('field')" @update:value="patch({ field: $event })" />
                    <n-select :value="model.operator || null" :options="operators" :aria-label="t('operator')" :placeholder="t('operator')"
                        @update:value="setOperator" />
                    <n-input :value="model.value" :placeholder="t('value')" :input-props="{ 'aria-label': t('value') }"
                        :maxlength="500" @update:value="patch({ value: $event })" />
                </div>
                <n-flex v-if="operatorOptions.length" align="center" class="condition-options">
                    <n-input v-for="option in operatorOptions" :key="option.key"
                        :value="String(model.options?.[option.key] || '')" size="small"
                        :placeholder="option.placeholder || option.label" :aria-label="option.label"
                        @update:value="setOption(option.key, $event)" />
                </n-flex>
            </template>
        </template>
    </div>
</template>

<style scoped>
.filter-editor { min-width: 0; width: 100%; box-sizing: border-box; }
.editor-toolbar, .node-toolbar { margin-bottom: 12px; }
.nested { border-left: 2px solid var(--n-border-color, #8884); padding-left: 14px; margin: 12px 0; }
.group-select { width: 180px; }
.condition-inputs { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr); gap: 8px; }
.condition-options { margin-top: 8px; }
@media (max-width: 640px) {
    .condition-inputs { grid-template-columns: minmax(0, 1fr); }
    .nested { padding-left: 8px; }
}
</style>
