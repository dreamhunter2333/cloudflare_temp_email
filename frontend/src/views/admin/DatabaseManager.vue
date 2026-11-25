<script setup>
import { computed, ref, onMounted } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { CleaningServicesFilled } from '@vicons/material'

import { api } from '../../api'
import { init } from 'vooks/lib/on-fonts-ready';

const message = useMessage()
const D1_STORAGE_PLAN_CONFIG_KEY = 'd1_storage_plan'
const dbVersionData = ref({
    need_initialization: false,
    need_migration: false,
    current_db_version: '',
    code_db_version: '',
    database_size: null
})
const selectedPlan = ref(null)
const savedPlan = ref(null)
const savingPlan = ref(false)

const planOptions = computed(() => [
    {
        label: t('free_plan'),
        value: 'free',
        databaseLimit: 500 * 1024 ** 2
    },
    {
        label: t('paid_plan'),
        value: 'paid',
        databaseLimit: 10 * 1024 ** 3
    }
])

const selectedPlanDetails = computed(() => (
    planOptions.value.find((plan) => plan.value === selectedPlan.value)
))

const storagePercentage = computed(() => {
    if (!selectedPlanDetails.value || dbVersionData.value.database_size === null) return 0
    return dbVersionData.value.database_size / selectedPlanDetails.value.databaseLimit * 100
})

const progressPercentage = computed(() => Math.min(storagePercentage.value, 100))

const progressStatus = computed(() => {
    if (storagePercentage.value >= 90) return 'error'
    if (storagePercentage.value >= 75) return 'warning'
    return 'success'
})

const { t } = useScopedI18n('views.admin.DatabaseManager')

const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined) return t('unavailable')
    if (bytes === 0) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / 1024 ** unitIndex
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

const fetchData = async () => {
    try {
        const [versionRes, configRes] = await Promise.all([
            api.fetch('/admin/db_version'),
            api.fetch(`/admin/config/${D1_STORAGE_PLAN_CONFIG_KEY}`)
        ]);
        if (versionRes) Object.assign(dbVersionData.value, versionRes);

        const configuredPlan = configRes?.value
        if (planOptions.value.some((plan) => plan.value === configuredPlan)) {
            selectedPlan.value = configuredPlan
            savedPlan.value = configuredPlan
        }
    } catch (error) {
        message.error(error.message || "error");
    }
}

const savePlan = async (plan) => {
    savingPlan.value = true
    try {
        await api.fetch('/admin/config', {
            method: 'POST',
            body: { key: D1_STORAGE_PLAN_CONFIG_KEY, value: plan }
        })
        savedPlan.value = plan
        message.success(t('planSaved'))
    } catch (error) {
        selectedPlan.value = savedPlan.value
        message.error(error.message || "error")
    } finally {
        savingPlan.value = false
    }
}

const initialization = async () => {
    try {
        await api.fetch('/admin/db_initialize', {
            method: 'POST'
        });
        await fetchData();
        message.success(t('initializationSuccess'));
    } catch (error) {
        message.error(error.message || "error");
    }
}

const migration = async () => {
    try {
        await api.fetch('/admin/db_migration', {
            method: 'POST'
        });
        await fetchData();
        message.success(t('migrationSuccess'));
    } catch (error) {
        message.error(error.message || "error");
    }
}

onMounted(async () => {
    await fetchData();
})
</script>


<template>
    <div class="center">
        <n-card :bordered="false" embedded>
            <n-alert v-if="dbVersionData.need_initialization" type="warning" :show-icon="false" :bordered="false">
                <span>{{ t('need_initialization_tip') }}</span>
                <n-button @click="initialization" type="primary" secondary block :loading="loading">
                    {{ t('init') }}
                </n-button>
            </n-alert>
            <n-alert v-if="dbVersionData.need_migration" type="warning" :show-icon="false" :bordered="false">
                <span>{{ t('need_migration_tip') }}</span>
                <n-button @click="migration" type="primary" secondary block :loading="loading">
                    {{ t('migration') }}
                </n-button>
            </n-alert>
            <n-alert type="info" :show-icon="false" :bordered="false">
                <span>
                    {{ t('current_db_version') }}: {{ dbVersionData.current_db_version || "unknown" }},
                    {{ t('code_db_version') }}: {{ dbVersionData.code_db_version }}
                </span>
            </n-alert>

            <div class="storage-panel">
                <div class="storage-heading">
                    <div>
                        <h3>{{ t('storage_title') }}</h3>
                        <p>{{ t('storage_description') }}</p>
                    </div>
                    <div class="plan-select">
                        <span>{{ t('plan') }}</span>
                        <n-select
                            v-model:value="selectedPlan"
                            :options="planOptions"
                            :placeholder="t('plan_placeholder')"
                            :disabled="dbVersionData.need_initialization"
                            :loading="savingPlan"
                            @update:value="savePlan"
                        />
                    </div>
                </div>

                <n-grid cols="1 s:2" responsive="screen" :x-gap="12" :y-gap="12">
                    <n-grid-item>
                        <div class="storage-stat">
                            <span>{{ t('current_database_size') }}</span>
                            <strong>{{ formatBytes(dbVersionData.database_size) }}</strong>
                        </div>
                    </n-grid-item>
                    <n-grid-item>
                        <div class="storage-stat">
                            <span>{{ t('single_database_limit') }}</span>
                            <strong>{{ selectedPlanDetails ? formatBytes(selectedPlanDetails.databaseLimit) : '—' }}</strong>
                        </div>
                    </n-grid-item>
                </n-grid>

                <div v-if="selectedPlanDetails" class="storage-progress">
                    <div class="storage-progress-label">
                        <span>{{ t('storage_usage') }}</span>
                        <span>{{ storagePercentage.toFixed(2) }}%</span>
                    </div>
                    <n-progress
                        type="line"
                        :percentage="progressPercentage"
                        :status="progressStatus"
                        :show-indicator="false"
                    />
                </div>

                <n-alert class="storage-tip" type="default" :show-icon="false" :bordered="false">
                    {{ t('storage_tip') }}
                </n-alert>
            </div>

        </n-card>
    </div>
</template>

<style scoped>
.n-card {
    max-width: 800px;
}

.n-alert {
    margin-bottom: 10px;
}

.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
}

.n-button {
    margin-top: 10px;
}

.storage-panel {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--n-border-color);
    text-align: left;
}

.storage-heading {
    display: flex;
    gap: 24px;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 16px;
}

.storage-heading h3,
.storage-heading p {
    margin: 0;
}

.storage-heading p {
    margin-top: 4px;
    color: var(--n-text-color-3);
}

.plan-select {
    width: 220px;
}

.plan-select > span {
    display: block;
    margin-bottom: 6px;
    color: var(--n-text-color-2);
}

.storage-stat {
    display: flex;
    min-height: 72px;
    padding: 14px;
    box-sizing: border-box;
    flex-direction: column;
    justify-content: space-between;
    border: 1px solid var(--n-border-color);
    border-radius: var(--n-border-radius);
}

.storage-stat span {
    color: var(--n-text-color-3);
}

.storage-stat strong {
    margin-top: 8px;
    font-size: 18px;
    color: var(--n-text-color);
}

.storage-progress {
    margin-top: 16px;
}

.storage-progress-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    color: var(--n-text-color-2);
}

.storage-tip {
    margin-top: 16px;
    margin-bottom: 0;
}

@media (max-width: 640px) {
    .storage-heading {
        align-items: stretch;
        flex-direction: column;
        gap: 12px;
    }

    .plan-select {
        width: 100%;
    }
}
</style>
