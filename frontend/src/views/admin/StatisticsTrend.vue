<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useThemeVars } from 'naive-ui'
import { use, connect, disconnect } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, DataZoomComponent, AriaComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useScopedI18n } from '@/i18n/app'

use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, CanvasRenderer])
const props = defineProps({ title: String, metric: String, color: String, points: Array, group: String })
const { t, locale } = useScopedI18n('views.admin.Statistics')
const theme = useThemeVars()
const format = value => new Intl.NumberFormat(locale.value).format(value)
const total = computed(() => props.points.reduce((n, point) => n + point[props.metric], 0))
const option = computed(() => ({
    animation: false,
    color: [props.color],
    textStyle: { fontFamily: 'inherit' },
    aria: { enabled: true, label: { description: t('chartLabel', { title: props.title, count: format(total.value) }) } },
    grid: { top: 12, right: 12, bottom: 28, left: 48 },
    tooltip: { trigger: 'axis', renderMode: 'richText', backgroundColor: theme.value.popoverColor,
        borderColor: theme.value.borderColor, textStyle: { color: theme.value.textColor1 },
        valueFormatter: format, axisPointer: { type: 'line', lineStyle: { color: theme.value.textColor3, type: 'dashed' } } },
    xAxis: { type: 'category', boundaryGap: false, data: props.points.map(point => point.day),
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.value.textColor2,
            formatter: day => day.slice(5).replace('-', '/') } },
    yAxis: { type: 'value', min: 0, minInterval: 1, splitNumber: 3,
        axisLabel: { color: theme.value.textColor2, formatter: format }, splitLine: { lineStyle: { color: theme.value.borderColor } } },
    dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }],
    series: [{ name: props.title, type: 'line', showSymbol: props.points.length === 1, symbolSize: 6,
        lineStyle: { width: 2 }, data: props.points.map(point => point[props.metric]) }],
}))
onMounted(() => connect(props.group))
onBeforeUnmount(() => disconnect(props.group))
</script>

<template>
    <n-card class="trend-panel" size="small">
        <h3>{{ title }}</h3>
        <div class="panel-total"><strong>{{ format(total) }}</strong></div>
        <VChart class="trend-chart" :option="option" :group="group" autoresize />
    </n-card>
</template>

<style scoped>
.trend-panel { min-width: 0; border-radius: 12px; }
.trend-panel :deep(.n-card__content) { padding: 22px 24px 18px; }
h3 { font-size: 14px; font-weight: 600; margin: 0; }
.panel-total { display: flex; gap: 12px; align-items: baseline; margin: 12px 0 14px; }
.panel-total strong { font-size: 28px; font-weight: 600; letter-spacing: -.02em; line-height: 1.3; }
.trend-chart { height: 210px; }
@media (max-width: 600px) {
    .trend-panel :deep(.n-card__content) { padding: 18px 16px 14px; }
}
</style>
