<script setup>
import { computed, defineAsyncComponent, ref, useId, watch } from 'vue'
import { useAsyncState } from '@vueuse/core'
import { useThemeVars } from 'naive-ui'
import { DateRangeOutlined, KeyboardArrowDownOutlined, RefreshOutlined } from '@vicons/material'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../../store'
import { api } from '../../api'
const StatisticsTrend = defineAsyncComponent(() => import('./StatisticsTrend.vue'))
const chartGroup = `statistics-${useId()}`

const DAY = 86400000
const presets = [{ days: 1, label: 'today' }, { days: 7, label: 'days7' }, { days: 30, label: 'days30' }]
const { t, locale } = useScopedI18n('views.admin.Statistics')
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const format = value => numberFormat.value.format(value)
const { openSettings } = useGlobalState()
const theme = useThemeVars()
const utcDay = () => new Date().toISOString().slice(0, 10)
const presetRange = (days, today = utcDay()) => [new Date(Date.parse(today) - (days - 1) * DAY).toISOString().slice(0, 10), today]
const range = ref(presetRange(7))
const preset = ref(presets[1])
const showTime = ref(false)
const draftRange = ref([...range.value])
const domain = ref('')
const userActivityMetrics = ['activeUserCount7days', 'activeUserCount30days']
const userTotalMetrics = ['userCount', ...userActivityMetrics]
const totalMetrics = ['mailCount', 'addressCount', 'userCount', 'sendMailCount',
    'activeAddressCount7days', 'activeAddressCount30days', ...userActivityMetrics]
const from = computed(() => range.value[0])
const to = computed(() => range.value[1])
const validRange = dates => dates && Date.parse(dates[1]) - Date.parse(dates[0]) < 30 * DAY
const draftError = computed(() => validRange(draftRange.value) ? '' : t('rangeLimit'))
const rangeLabel = computed(() => preset.value ? t(preset.value.label) : range.value.join(' – '))
const domainOptions = computed(() => [{ label: t('allDomains'), value: '' }, ...openSettings.value.domains])
const panels = computed(() => [
    { metric: 'mailCount', title: t('received'), color: theme.value.primaryColor },
    { metric: 'sendMailCount', title: t('sent'), color: theme.value.warningColorPressed },
    { metric: 'userCount', title: t('newUsers'), color: theme.value.textColor2, global: !!domain.value },
    { metric: 'addressCount', title: t('newAddresses'), color: theme.value.infoColor },
])
const colors = computed(() => ({
    '--text': theme.value.textColor1, '--line': theme.value.borderColor,
}))

const pending = new Map()
const fetchStatisticsData = async params => {
    const query = new URLSearchParams(params).toString()
    if (pending.has(query)) return pending.get(query)
    const request = api.fetch(`/admin/statistics?${query}`, { showLoading: false }).finally(() => pending.delete(query))
    pending.set(query, request)
    return request
}
const fetchTrends = async (params, userRows) => {
    const data = await fetchStatisticsData(params)
    const series = userRows ? { userCount: userRows, ...data } : data
    const counts = Object.entries(series).map(([key, rows]) => [key, new Map(rows.map(row => [row.day, row.count]))])
    const start = Date.parse(params.from)
    const hourly = params.from === params.to
    const step = hourly ? DAY / 24 : DAY
    const now = new Date()
    let length = (Date.parse(params.to) + DAY - start) / step
    if (hourly && params.to === now.toISOString().slice(0, 10)) {
        const hoursWithData = Object.values(series).flat().filter(row => row.count > 0)
            .map(row => Number(row.day.slice(11, 13)))
        length = Math.max(now.getUTCHours(), ...hoursWithData) + 1
    }
    const daily = Array.from({ length }, (_, i) => {
        const iso = new Date(start + i * step).toISOString()
        const day = hourly ? iso.slice(0, 16).replace('T', ' ') : iso.slice(0, 10)
        return { day, ...Object.fromEntries(counts.map(([key, values]) => [key, values.get(day) ?? 0])) }
    })
    return { interval: hourly ? 'hour' : 'day', daily, userRows: series.userCount }
}
let userTotalsRequest
const fetchTotalStats = async (params, reuseUsers) => {
    if (reuseUsers && userTotalsRequest) {
        const [userTotals, mailboxTotals] = await Promise.all([
            userTotalsRequest,
            fetchStatisticsData({ ...params, skipUsers: 'true' }),
        ])
        if (userTotals) return { ...userTotals, ...mailboxTotals }
    }

    const request = fetchStatisticsData(params)
    const users = request.then(data => {
        if (userTotalMetrics.every(key => data?.[key] != null)) {
            return Object.fromEntries(userTotalMetrics.map(key => [key, data[key]]))
        }
    }, () => undefined)
    userTotalsRequest = users
    try {
        return await request
    } finally {
        const userTotals = await users
        if (!userTotals && userTotalsRequest === users) userTotalsRequest = undefined
    }
}
const loadOptions = { immediate: false, onError: () => {} }
const { state: statistics, isLoading: loading, error, executeImmediate: loadTrends } = useAsyncState(fetchTrends, null, loadOptions)
const { state: totals, isLoading: totalsLoading, error: totalsError, executeImmediate: loadTotals } = useAsyncState(fetchTotalStats, null, loadOptions)
const fetchStatistics = (reuseUsers = false) => {
    const userRows = reuseUsers ? statistics.value?.userRows : undefined
    const params = { from: from.value, to: to.value, domain: domain.value }
    if (userRows) params.skipUsers = 'true'
    return loadTrends(params, userRows)
}
const fetchTotals = (reuseUsers = false) => loadTotals({ view: 'totals', domain: domain.value }, reuseUsers)
const loadError = computed(() => {
    const cause = error.value || totalsError.value
    return cause ? cause.message || t('loadError') : ''
})
const syncPresetRange = () => {
    const today = utcDay()
    if (!preset.value || to.value === today) return false
    range.value = presetRange(preset.value.days, today)
    return true
}
const refresh = () => Promise.all([syncPresetRange() ? undefined : fetchStatistics(), fetchTotals()])
const selectPreset = option => {
    preset.value = option
    range.value = presetRange(option.days)
    showTime.value = false
}
const applyRange = (_, dates) => {
    if (!validRange(dates)) return
    showTime.value = false
    if (dates[0] === from.value && dates[1] === to.value) return
    preset.value = null
    range.value = dates
}
watch(showTime, value => { if (value) draftRange.value = [...range.value] })
watch([from, to, domain], ([start, end], [previousStart, previousEnd] = []) => {
    if (!syncPresetRange()) fetchStatistics(start === previousStart && end === previousEnd)
}, { immediate: true })
watch(domain, () => fetchTotals(true), { immediate: true })
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
                                <n-button v-for="option in presets" :key="option.days" size="small" :type="preset?.days === option.days ? 'primary' : 'default'"
                                    :secondary="preset?.days === option.days" @click="selectPreset(option)">{{ t(option.label) }}</n-button>
                                <n-tag size="small" :bordered="false">UTC</n-tag>
                            </div>
                            <n-date-picker v-model:formatted-value="draftRange" value-format="yyyy-MM-dd" panel type="daterange" :actions="['confirm']"
                                :is-date-disabled="timestamp => timestamp > new Date(`${utcDay()}T00:00:00`).getTime()" @confirm="applyRange">
                                <template #footer><span class="range-help">{{ draftError || t('rangeHelp') }}</span></template>
                                <template #confirm="{ onConfirm, disabled }"><n-button size="small" type="primary" :disabled="disabled || !!draftError" @click="onConfirm">{{ t('applyRange') }}</n-button></template>
                            </n-date-picker>
                        </n-scrollbar>
                    </div>
                </n-popover>
                <n-button secondary :loading="loading || totalsLoading" @click="refresh">
                    <template #icon><n-icon :component="RefreshOutlined" /></template>{{ t('refresh') }}
                </n-button>
            </div>
        </div>
        <n-alert v-if="loadError" type="error" class="error">{{ loadError }}</n-alert>
        <div class="totals">
            <n-card v-for="key in totalMetrics" :key="key" size="small">
                <n-statistic :label="t(key)" :value="totals?.[key] != null ? format(totals[key]) : undefined" tabular-nums>
                    <template v-if="totals?.[key] == null" #default><n-skeleton v-if="totalsLoading" height="30px" width="100px" /><span v-else>—</span></template>
                </n-statistic>
            </n-card>
        </div>
        <div v-if="loading" class="charts"><n-skeleton v-for="panel in panels" :key="panel.metric" height="322px" /></div>
        <div v-else-if="statistics?.daily.length" class="charts">
            <StatisticsTrend v-for="panel in panels" :key="panel.metric" v-bind="panel" :points="statistics.daily"
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
