<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { isFilterExpression, type FilterExpression, type FilterField, type FilterOperator } from './filter'

const props = withDefaults(defineProps<{
    modelValue?: FilterExpression | null
    fields: FilterField[]
    operators: FilterOperator[]
    allowCustomFields?: boolean
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
const valid = computed(() => props.modelValue == null || isFilterExpression(props.modelValue))
const group = computed(() => !!props.modelValue && ['and', 'or', 'not'].includes(props.modelValue.operator))
const groupOptions = computed(() => ['and', 'or', 'not'].map(value => ({ label: t(value), value, key: value })))
const operatorOptions = computed(() => props.operators.find(item => item.value === props.modelValue?.operator)?.options || [])
const condition = (): FilterExpression => ({ field: props.fields[0]?.value || '', operator: props.operators[0]?.value || '', value: '' })
const update = (value: FilterExpression | null) => emit('update:modelValue', value)
const patch = (value: Partial<FilterExpression>) => update({ ...props.modelValue!, ...value })
const setOperator = (operator: string) => update({ field: props.modelValue?.field, operator, value: props.modelValue?.value || '' })
const setOption = (key: string, value: unknown) => patch({ options: { ...props.modelValue?.options, [key]: value } })
const changeGroup = (operator: string) => {
    const children = props.modelValue?.children || []
    patch({ operator, children: operator === 'not' && children.length > 1 ? [{ operator: 'and', children }] : children })
}
const wrap = (operator: string) => update({ operator, children: [props.modelValue || condition()] })
const updateChild = (index: number, value: FilterExpression | null) => {
    const children = [...(props.modelValue?.children || [])]
    if (value === null) children.splice(index, 1)
    else children[index] = value
    // Removing the last child removes the group; never save an ambiguous empty group.
    update(children.length ? { ...props.modelValue!, children } : null)
}
const changeMode = (value: string) => {
    mode.value = value
    json.value = JSON.stringify(props.modelValue ?? null, null, 2)
}
const editJson = (value: string) => {
    json.value = value
    try {
        const parsed = JSON.parse(value)
        if (parsed !== null && !isFilterExpression(parsed)) throw new Error('Invalid expression')
        jsonError.value = false
        update(parsed)
        emit('validity-change', true)
    } catch {
        jsonError.value = true
        emit('validity-change', false)
    }
}
watch(valid, value => emit('validity-change', value && !jsonError.value), { immediate: true })
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
        <n-alert v-else-if="!valid || depth > 8" type="error">{{ t('invalid') }}</n-alert>
        <n-button v-else-if="!modelValue" dashed @click="update(condition())">{{ t('addCondition') }}</n-button>
        <template v-else>
            <n-flex align="center" :wrap="true" class="node-toolbar">
                <n-select v-if="group" class="group-select" :value="modelValue.operator" :options="groupOptions"
                    :aria-label="t('logic')" @update:value="changeGroup" />
                <n-text v-else depth="3">{{ t('condition') }}</n-text>
                <n-dropdown v-if="depth < 8" :options="groupOptions" trigger="click" @select="wrap">
                    <n-button size="small" quaternary>{{ t('wrap') }}</n-button>
                </n-dropdown>
                <n-button size="small" quaternary type="error" @click="update(null)">{{ t('remove') }}</n-button>
            </n-flex>
            <template v-if="group">
                <FilterEditor v-for="(child, index) in modelValue.children" :key="index"
                    :model-value="child" :fields="fields" :operators="operators" :depth="depth + 1"
                    :allow-custom-fields="allowCustomFields" @update:model-value="updateChild(index, $event)" />
                <n-button v-if="modelValue.operator !== 'not' && depth < 8" size="small" dashed
                    @click="patch({ children: [...(modelValue.children || []), condition()] })">{{ t('addCondition') }}</n-button>
            </template>
            <template v-else>
                <div class="condition-inputs">
                    <n-select :value="modelValue.field" :options="fields" filterable :tag="allowCustomFields"
                        :aria-label="t('field')" :placeholder="t('field')" @update:value="patch({ field: $event })" />
                    <n-select :value="modelValue.operator" :options="operators" :aria-label="t('operator')"
                        @update:value="setOperator" />
                    <n-input :value="modelValue.value" :placeholder="t('value')" :input-props="{ 'aria-label': t('value') }"
                        :maxlength="500" @update:value="patch({ value: $event })" />
                </div>
                <n-flex v-if="operatorOptions.length" align="center" class="condition-options">
                    <template v-for="option in operatorOptions" :key="option.key">
                        <n-checkbox v-if="option.type === 'boolean'" :checked="modelValue.options?.[option.key] === true"
                            @update:checked="setOption(option.key, $event)">{{ option.label }}</n-checkbox>
                        <n-input v-else :value="String(modelValue.options?.[option.key] || '')" size="small"
                            :placeholder="option.placeholder || option.label" :aria-label="option.label"
                            @update:value="setOption(option.key, $event)" />
                    </template>
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
