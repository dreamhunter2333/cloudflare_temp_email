<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'
import { CleaningServicesFilled } from '@vicons/material'

import { api } from '../../api'

const message = useMessage()
const cleanupModel = ref({
    enableMailsAutoCleanup: false,
    cleanMailsDays: 30,
    enableUnknowMailsAutoCleanup: false,
    cleanUnknowMailsDays: 30,
    enableAddressAutoCleanup: false,
    cleanAddressDays: 30,
    enableSendBoxAutoCleanup: false,
    cleanSendBoxDays: 30,
})

const { t } = useI18n({
    messages: {
        en: {
            tip: 'Please input the days',
            mailBoxLabel: 'Cleanup the inbox before n days',
            mailUnknowLabel: "Cleanup the unknow mail before n days",
            sendBoxLabel: "Cleanup the sendbox before n days",
            cleanupNow: "Cleanup now",
            autoCleanup: "Auto cleanup",
            cleanupSuccess: "Cleanup success",
            save: "Save",
            cronTip: "Enable cron cleanup, need to configure [crons] in worker, please refer to the document",
        },
        zh: {
            tip: '请输入天数',
            mailBoxLabel: '清理 n 天前的收件箱',
            mailUnknowLabel: "清理 n 天前的无收件人邮件",
            sendBoxLabel: "清理 n 天前的发件箱",
            autoCleanup: "自动清理",
            cleanupSuccess: "清理成功",
            cleanupNow: "立即清理",
            save: "保存",
            cronTip: "启用定时清理, 需在 worker 配置 [crons] 参数, 请参考文档",
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

const fetchData = async () => {
    try {
        const res = await api.fetch('/admin/auto_cleanup');
        if (res) Object.assign(cleanupModel.value, res);
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
        message.success(t('cleanupSuccess'));
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
            <n-alert :show-icon="false" :bordered="false">
                <span>{{ t('cronTip') }}</span>
            </n-alert>
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
                <n-button @click="save" type="primary" block :loading="loading">
                    {{ t('save') }}
                </n-button>
            </n-form>
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

.item {
    display: flex;
    margin: 10px;
}
</style>
