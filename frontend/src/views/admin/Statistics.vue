<script setup>
import { computed, defineAsyncComponent, ref, useId, watch } from 'vue'
import { useThemeVars } from 'naive-ui'
import { DateRangeOutlined, KeyboardArrowDownOutlined, RefreshOutlined } from '@vicons/material'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../../store'
import { api } from '../../api'
const StatisticsTrend = defineAsyncComponent(() => import('./StatisticsTrend.vue'))
const chartGroup = `statistics-${useId()}`

const DAY = 86400000
const { t, locale } = useScopedI18n('views.admin.Statistics')
const format = value => new Intl.NumberFormat(locale.value).format(value)
const { openSettings } = useGlobalState()
const theme = useThemeVars()
const utcDay = () => new Date().toISOString().slice(0, 10)
const localDate = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
const dayKey = timestamp => { const date = new Date(timestamp); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
const presetRange = (days, today = utcDay()) => [localDate(new Date(Date.parse(today) - (days - 1) * DAY).toISOString().slice(0, 10)), localDate(today)]
const range = ref(presetRange(7))
const preset = ref(7)
const showTime = ref(false)
const draftRange = ref([...range.value])
const domain = ref('')
const statistics = ref(null)
const totals = ref(null)
const totalsLoading = ref(false)
const totalsError = ref('')
const loading = ref(false)
const error = ref('')
const pending = new Map()
let requestId = 0
let totalsRequestId = 0
const totalMetrics = ['mailCount', 'addressCount', 'userCount', 'sendMailCount']
const activityMetrics = ['activeAddressCount7days', 'activeAddressCount30days']
const from = computed(() => dayKey(range.value[0]))
const to = computed(() => dayKey(range.value[1]))
const rangeError = computed(() => Date.parse(to.value) - Date.parse(from.value) >= 30 * DAY ? t('rangeLimit') : '')
const draftError = computed(() => !draftRange.value || Date.parse(dayKey(draftRange.value[1])) - Date.parse(dayKey(draftRange.value[0])) >= 30 * DAY ? t('rangeLimit') : '')
const rangeLabel = computed(() => preset.value ? t(preset.value === 1 ? 'today' : preset.value === 7 ? 'days7' : 'days30') : `${from.value} – ${to.value}`)
const domainOptions = computed(() => [{ label: t('allDomains'), value: '' }, ...openSettings.value.domains])
const series = computed(() => statistics.value?.daily ?? [])
const panels = computed(() => [
    { metric: 'mailCount', title: t('received'), color: theme.value.primaryColor },
    { metric: 'addressCount', title: t('newAddresses'), color: theme.value.infoColor },
    { metric: 'sendMailCount', title: t('sent'), color: theme.value.warningColorPressed },
    { metric: 'userCount', title: t('newUsers'), color: theme.value.textColor2, global: true },
])
const colors = computed(() => ({
    '--accent': theme.value.primaryColor, '--text': theme.value.textColor1,
    '--muted': theme.value.textColor2, '--line': theme.value.borderColor,
    '--surface': theme.value.cardColor,
}))

const fetchStatisticsData = query => {
    if (pending.has(query)) return pending.get(query)
    const request = api.fetch(`/admin/statistics?${query}`, { showLoading: false }).finally(() => pending.delete(query))
    pending.set(query, request)
    return request
}
const fetchStatistics = async () => {
    const id = ++requestId
    error.value = ''
    statistics.value = null
    loading.value = false
    if (rangeError.value) return
    const query = new URLSearchParams({ from: from.value, to: to.value, domain: domain.value }).toString()
    loading.value = true
    try {
        const snapshot = await fetchStatisticsData(query)
        if (id === requestId) statistics.value = snapshot
    } catch (cause) {
        if (id === requestId) error.value = cause.message || t('loadError')
    } finally {
        if (id === requestId) loading.value = false
    }
}
const fetchTotals = async () => {
    const id = ++totalsRequestId
    const query = new URLSearchParams({ view: 'totals', domain: domain.value }).toString()
    totalsError.value = ''
    totals.value = null
    totalsLoading.value = true
    try {
        const snapshot = await fetchStatisticsData(query)
        if (id === totalsRequestId) totals.value = snapshot
    } catch (cause) {
        if (id === totalsRequestId) totalsError.value = cause.message || t('loadError')
    } finally {
        if (id === totalsRequestId) totalsLoading.value = false
    }
}
const syncPresetRange = () => {
    const today = utcDay()
    if (!preset.value || to.value === today) return false
    range.value = presetRange(preset.value, today)
    return true
}
const refresh = () => Promise.all([syncPresetRange() ? undefined : fetchStatistics(), fetchTotals()])
const selectPreset = value => { preset.value = value; range.value = presetRange(value); showTime.value = false }
const applyRange = () => {
    if (draftError.value) return
    showTime.value = false
    if (dayKey(draftRange.value[0]) === from.value && dayKey(draftRange.value[1]) === to.value) return
    preset.value = null
    range.value = [...draftRange.value]
}
watch(showTime, value => { if (value) draftRange.value = [...range.value] })
watch([from, to, domain], () => {
    if (!syncPresetRange()) fetchStatistics()
}, { immediate: true })
watch(domain, () => fetchTotals(), { immediate: true })
</script>

<template>
    <section class="dashboard" :style="colors" :aria-busy="loading || totalsLoading">
        <div class="filters">
            <div class="domain-filter"><span>{{ t('mailboxDomain') }}</span>
                <n-select v-model:value="domain" :options="domainOptions" filterable :disabled="loading" :aria-label="t('mailboxDomain')" />
            </div>
            <div class="toolbar-actions">
                <n-popover v-model:show="showTime" trigger="click" placement="bottom-end" :show-arrow="false" :style="{ padding: 0 }">
                    <template #trigger>
                        <n-button :aria-label="t('dateRange')" :aria-expanded="showTime" aria-haspopup="dialog" :title="`${from} – ${to}`">
                            <template #icon><n-icon :component="DateRangeOutlined" /></template>
                            {{ rangeLabel }}<n-icon :component="KeyboardArrowDownOutlined" />
                        </n-button>
                    </template>
                    <div class="time-panel" role="dialog" :aria-label="t('dateRange')" @keydown.esc="showTime = false">
                        <n-scrollbar style="max-height: 60vh">
                            <div class="quick-ranges">
                                <n-button v-for="value in [1, 7, 30]" :key="value" size="small" :type="preset === value ? 'primary' : 'default'" :secondary="preset === value" @click="selectPreset(value)">{{ t(value === 1 ? 'today' : value === 7 ? 'days7' : 'days30') }}</n-button>
                                <n-tag size="small" :bordered="false">UTC</n-tag>
                            </div>
                            <n-date-picker v-model:value="draftRange" panel type="daterange" :actions="['confirm']"
                                :is-date-disabled="timestamp => dayKey(timestamp) > utcDay()" @confirm="applyRange">
                                <template #footer><span class="range-help">{{ draftError || t('rangeHelp') }}</span></template>
                                <template #confirm="{ onConfirm, disabled }"><n-button size="small" type="primary" :disabled="disabled || !!draftError" @click="onConfirm">{{ t('applyRange') }}</n-button></template>
                            </n-date-picker>
                        </n-scrollbar>
                    </div>
                </n-popover>
                <n-button secondary :loading="loading || totalsLoading" :disabled="!!rangeError" @click="refresh">
                    <template #icon><n-icon :component="RefreshOutlined" /></template>{{ t('refresh') }}
                </n-button>
            </div>
        </div>
        <n-alert v-if="error || rangeError || totalsError" type="error" class="error">{{ rangeError || error || totalsError }}</n-alert>
        <div class="totals">
            <n-card v-for="key in totalMetrics" :key="key" size="small">
                <n-statistic :label="t(key)" :value="totals ? format(totals[key]) : undefined" tabular-nums>
                    <template v-if="!totals" #default><n-skeleton v-if="totalsLoading" height="30px" width="100px" /><span v-else>—</span></template>
                </n-statistic>
                <div v-if="key === 'addressCount' && totals?.activeAddressCount7days !== undefined" class="mailbox-activity">
                    <div v-for="metric in activityMetrics" :key="metric">
                        <n-text depth="3">{{ t(metric) }}</n-text><strong>{{ format(totals[metric]) }}</strong>
                    </div>
                </div>
            </n-card>
        </div>
        <div v-if="loading" class="charts"><n-skeleton v-for="panel in panels" :key="panel.metric" height="322px" /></div>
        <div v-else-if="statistics && series.length" class="charts">
            <StatisticsTrend v-for="panel in panels" :key="panel.metric" v-bind="panel" :points="series"
                :interval="statistics.interval" :group="chartGroup" />
        </div>
    </section>
</template>

<style scoped>
.dashboard { color: var(--text); font-variant-numeric: tabular-nums; text-align: left; }
.filters { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 0 22px; border-bottom: 1px solid var(--line); margin-bottom: 22px; flex-wrap: wrap; }
.domain-filter { display: flex; align-items: center; gap: 12px; }
.domain-filter > span { font-size: 13px; white-space: nowrap; }
.domain-filter :deep(.n-select) { width: 230px; }
.toolbar-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.time-panel { max-width: calc(100vw - 24px); }
.time-panel :deep(.n-scrollbar-container) { overscroll-behavior: contain; }
.quick-ranges { display: flex; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--n-divider-color); }
.range-help { font-size: 12px; }
.charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; margin-bottom: 20px; }
.mailbox-activity { display: grid; gap: 4px; margin-top: 8px; font-size: 12px; }
.mailbox-activity > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 8px; }
.error { margin-bottom: 20px; }
@media (max-width: 1024px) {
    .dashboard { padding-inline: 16px; }
}
@media (max-width: 900px) {
    .filters { gap: 14px; }
}
@media (max-width: 650px) {
    .charts { grid-template-columns: 1fr; gap: 16px; }
    .totals { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .domain-filter { width: 100%; }
    .domain-filter :deep(.n-select) { width: auto; flex: 1; }
    .toolbar-actions { width: 100%; justify-content: space-between; }
    .time-panel :deep(.n-date-panel--daterange) { grid-template-areas: "left-calendar" "right-calendar" "footer" "action"; }
    .time-panel :deep(.n-date-panel__vertical-divider) { display: none; }
}
</style>
