<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n({
    messages: {
        en: {
            tip: 'Please input the days',
            mailBoxLabel: 'Cleanup the inbox before n days',
            mailUnknowLabel: "Cleanup the unknow mail before n days",
            sendBoxLabel: "Cleanup the sendbox before n days",
            addressCreateLabel: "Cleanup the address created before n days",
            inactiveAddressLabel: "Cleanup the inactive address before n days",
            unboundAddressLabel: "Cleanup the unbound address before n days",
            emptyAddressLabel: "Cleanup the empty address before n days",
            cleanupNow: "Cleanup now",
            autoCleanup: "Auto cleanup",
            cleanupSuccess: "Cleanup success",
            saveSuccess: "Save success",
            save: "Save",
            cronTip: "Enable cron cleanup, need to configure [crons] in worker, please refer to the document, setting 0 days means clear all",
            basicCleanup: "Basic Cleanup",
            customSqlCleanup: "Custom SQL Cleanup",
            customSqlTip: "Add custom DELETE SQL statements for scheduled cleanup. Only single DELETE statement is allowed per entry.",
            addCustomSql: "Add Custom SQL",
            sqlName: "Name",
            sqlStatement: "SQL Statement (DELETE only)",
            sqlNamePlaceholder: "e.g. Clean old logs",
            sqlPlaceholder: "e.g. DELETE FROM raw_mails WHERE source GLOB '*{'@'}example.com' AND created_at < datetime('now', '-3 day')",
            deleteCustomSql: "Delete",
        },
        zh: {
            tip: '请输入天数',
            mailBoxLabel: '清理 n 天前的收件箱',
            mailUnknowLabel: "清理 n 天前的无收件人邮件",
            sendBoxLabel: "清理 n 天前的发件箱",
            addressCreateLabel: "清理 n 天前创建的地址",
            inactiveAddressLabel: "清理 n 天前的未活跃地址",
            unboundAddressLabel: "清理 n 天前的未绑定用户地址",
            emptyAddressLabel: "清理 n 天前空邮件的邮箱地址",
            autoCleanup: "自动清理",
            cleanupSuccess: "清理成功",
            saveSuccess: "保存成功",
            cleanupNow: "立即清理",
            save: "保存",
            cronTip: "启用定时清理, 需在 worker 配置 [crons] 参数, 请参考文档, 配置为 0 天表示全部清空",
            basicCleanup: "基础清理",
            customSqlCleanup: "自定义 SQL 清理",
            customSqlTip: "添加自定义 DELETE SQL 语句进行定时清理。每条记录仅允许单条 DELETE 语句。",
            addCustomSql: "添加自定义 SQL",
            sqlName: "名称",
            sqlStatement: "SQL 语句 (仅限 DELETE)",
            sqlNamePlaceholder: "例如: 清理旧日志",
            sqlPlaceholder: "例如: DELETE FROM raw_mails WHERE source GLOB '*{'@'}example.com' AND created_at < datetime('now', '-3 day')",
            deleteCustomSql: "删除",
        }
    }
});

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
