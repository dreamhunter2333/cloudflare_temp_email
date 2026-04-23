<script setup>
import { ref, onMounted } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { CleaningServicesFilled, AddFilled, DeleteFilled } from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading } = useGlobalState()
const message = useMessage()
const cleanupModel = ref({
    enableMailsAutoCleanup: false,
    cleanMailsDays: 30,
    enableUnknowMailsAutoCleanup: false,
    cleanUnknowMailsDays: 30,
    enableSendBoxAutoCleanup: false,
    cleanSendBoxDays: 30,
    enableAddressAutoCleanup: false,
    cleanAddressDays: 30,
    enableInactiveAddressAutoCleanup: false,
    cleanInactiveAddressDays: 30,
    enableUnboundAddressAutoCleanup: false,
    cleanUnboundAddressDays: 30,
    enableEmptyAddressAutoCleanup: false,
    cleanEmptyAddressDays: 30,
    customSqlCleanupList: []
})

const { t } = useScopedI18n('views.admin.Maintenance')

const cleanup = async (cleanType, cleanDays) => {
    try {
        await api.fetch('/admin/cleanup', {
            method: 'POST',
            body: JSON.stringify({ cleanType, cleanDays })
        });
        message.success(t('cleanupSuccess'));
    } catch (error) {
        message.error(error.message || "error");
    }
}

const addCustomSql = () => {
    if (!cleanupModel.value.customSqlCleanupList) {
        cleanupModel.value.customSqlCleanupList = [];
    }
    cleanupModel.value.customSqlCleanupList.push({
        id: Date.now().toString(),
        name: '',
        sql: '',
        enabled: false
    });
}

const removeCustomSql = (index) => {
    cleanupModel.value.customSqlCleanupList.splice(index, 1);
}

const fetchData = async () => {
    try {
        const res = await api.fetch('/admin/auto_cleanup');
        if (res) Object.assign(cleanupModel.value, res);
        if (!cleanupModel.value.customSqlCleanupList) {
            cleanupModel.value.customSqlCleanupList = [];
        }
    } catch (error) {
        message.error(error.message || "error");
    }
}

const save = async () => {
    try {
        await api.fetch('/admin/auto_cleanup', {
            method: 'POST',
            body: JSON.stringify(cleanupModel.value)
        });
        message.success(t('saveSuccess'));
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
            <n-alert :show-icon="false" :bordered="false" type="warning">
                <span>{{ t('cronTip') }}</span>
            </n-alert>
            <n-flex justify="end">
                <n-button @click="save" type="primary" :loading="loading">
                    {{ t('save') }}
                </n-button>
            </n-flex>
            <n-tabs type="segment" style="margin-top: 16px;">
                <n-tab-pane name="basic" :tab="t('basicCleanup')">
                    <n-form :model="cleanupModel">
                        <n-form-item-row :label="t('mailBoxLabel')">
                            <n-checkbox v-model:checked="cleanupModel.enableMailsAutoCleanup">
                                {{ t('autoCleanup') }}
                            </n-checkbox>
                            <n-input-number v-model:value="cleanupModel.cleanMailsDays" :placeholder="t('tip')" />
                            <n-button @click="cleanup('mails', cleanupModel.cleanMailsDays)">
                                <template #icon>
                                    <n-icon :component="CleaningServicesFilled" />
                                </template>
                                {{ t('cleanupNow') }}
                            </n-button>
                        </n-form-item-row>
                        <n-form-item-row :label="t('mailUnknowLabel')">
                            <n-checkbox v-model:checked="cleanupModel.enableUnknowMailsAutoCleanup">
                                {{ t('autoCleanup') }}
                            </n-checkbox>
                            <n-input-number v-model:value="cleanupModel.cleanUnknowMailsDays" :placeholder="t('tip')" />
                            <n-button @click="cleanup('mails_unknow', cleanupModel.cleanUnknowMailsDays)">
                                <template #icon>
                                    <n-icon :component="CleaningServicesFilled" />
                                </template>
                                {{ t('cleanupNow') }}
                            </n-button>
                        </n-form-item-row>
                        <n-form-item-row :label="t('sendBoxLabel')">
                            <n-checkbox v-model:checked="cleanupModel.enableSendBoxAutoCleanup">
                                {{ t('autoCleanup') }}
                            </n-checkbox>
                            <n-input-number v-model:value="cleanupModel.cleanSendBoxDays" :placeholder="t('tip')" />
                            <n-button @click="cleanup('sendbox', cleanupModel.cleanSendBoxDays)">
                                <template #icon>
                                    <n-icon :component="CleaningServicesFilled" />
                                </template>
                                {{ t('cleanupNow') }}
                            </n-button>
                        </n-form-item-row>
                        <n-form-item-row :label="t('addressCreateLabel')">
                            <n-checkbox v-model:checked="cleanupModel.enableAddressAutoCleanup">
                                {{ t('autoCleanup') }}
                            </n-checkbox>
                            <n-input-number v-model:value="cleanupModel.cleanAddressDays" :placeholder="t('tip')" />
                            <n-button @click="cleanup('addressCreated', cleanupModel.cleanAddressDays)">
                                <template #icon>
                                    <n-icon :component="CleaningServicesFilled" />
                                </template>
                                {{ t('cleanupNow') }}
                            </n-button>
                        </n-form-item-row>
                        <n-form-item-row :label="t('inactiveAddressLabel')">
                            <n-checkbox v-model:checked="cleanupModel.enableInactiveAddressAutoCleanup">
                                {{ t('autoCleanup') }}
                            </n-checkbox>
                            <n-input-number v-model:value="cleanupModel.cleanInactiveAddressDays" :placeholder="t('tip')" />
                            <n-button @click="cleanup('inactiveAddress', cleanupModel.cleanInactiveAddressDays)">
                                <template #icon>
                                    <n-icon :component="CleaningServicesFilled" />
                                </template>
                                {{ t('cleanupNow') }}
                            </n-button>
                        </n-form-item-row>
                        <n-form-item-row :label="t('unboundAddressLabel')">
                            <n-checkbox v-model:checked="cleanupModel.enableUnboundAddressAutoCleanup">
                                {{ t('autoCleanup') }}
                            </n-checkbox>
                            <n-input-number v-model:value="cleanupModel.cleanUnboundAddressDays" :placeholder="t('tip')" />
                            <n-button @click="cleanup('unboundAddress', cleanupModel.cleanUnboundAddressDays)">
                                <template #icon>
                                    <n-icon :component="CleaningServicesFilled" />
                                </template>
                                {{ t('cleanupNow') }}
                            </n-button>
                        </n-form-item-row>
                        <n-form-item-row :label="t('emptyAddressLabel')">
                            <n-checkbox v-model:checked="cleanupModel.enableEmptyAddressAutoCleanup">
                                {{ t('autoCleanup') }}
                            </n-checkbox>
                            <n-input-number v-model:value="cleanupModel.cleanEmptyAddressDays" :placeholder="t('tip')" />
                            <n-button @click="cleanup('emptyAddress', cleanupModel.cleanEmptyAddressDays)">
                                <template #icon>
                                    <n-icon :component="CleaningServicesFilled" />
                                </template>
                                {{ t('cleanupNow') }}
                            </n-button>
                        </n-form-item-row>
                    </n-form>
                </n-tab-pane>
                <n-tab-pane name="custom_sql" :tab="t('customSqlCleanup')">
                    <n-alert :show-icon="false" :bordered="false" type="info" style="margin-bottom: 16px;">
                        <span>{{ t('customSqlTip') }}</span>
                    </n-alert>
                    <n-space vertical>
                        <n-card v-for="(item, index) in cleanupModel.customSqlCleanupList" :key="item.id" size="small">
                            <n-space vertical>
                                <n-space align="center">
                                    <n-checkbox v-model:checked="item.enabled">
                                        {{ t('autoCleanup') }}
                                    </n-checkbox>
                                    <n-input v-model:value="item.name" :placeholder="t('sqlNamePlaceholder')" style="width: 200px;" />
                                    <n-button @click="removeCustomSql(index)" type="error" quaternary>
                                        <template #icon>
                                            <n-icon :component="DeleteFilled" />
                                        </template>
                                        {{ t('deleteCustomSql') }}
                                    </n-button>
                                </n-space>
                                <n-input
                                    v-model:value="item.sql"
                                    type="textarea"
                                    :placeholder="t('sqlPlaceholder')"
                                    :autosize="{ minRows: 2 }"
                                    class="sql-input"
                                />
                            </n-space>
                        </n-card>
                        <n-button @click="addCustomSql">
                            <template #icon>
                                <n-icon :component="AddFilled" />
                            </template>
                            {{ t('addCustomSql') }}
                        </n-button>
                    </n-space>
                </n-tab-pane>
            </n-tabs>
        </n-card>
    </div>
</template>

<style scoped>
.n-card {
    max-width: 800px;
}

.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
}

.n-alert {
    margin-bottom: 20px;
}

.sql-input {
    text-align: left;
}
</style>
