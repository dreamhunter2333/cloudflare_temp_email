<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'
import { User, UserCheck, MailBulk } from '@vicons/fa'
import { SendOutlined } from '@vicons/material'

import { api } from '../../api'

const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            userCount: 'User Count',
            addressCount: 'Address Count',
            activeAddressCount7days: '7 days Active Address Count',
            activeAddressCount30days: '30 days Active Address Count',
            mailCount: 'Mail Count',
            sendMailCount: 'Send Mail Count'
        },
        zh: {
            userCount: '用户总数',
            addressCount: '邮箱地址总数',
            activeAddressCount7days: '7天活跃邮箱地址总数',
            activeAddressCount30days: '30天活跃邮箱地址总数',
            mailCount: '邮件总数',
            sendMailCount: '发送邮件总数'
        }
    }
});

const statistics = ref({
    addressCount: 0,
    userCount: 0,
    mailCount: 0,
    activeAddressCount7days: 0,
    activeAddressCount30days: 0,
    sendMailCount: 0,
})

const fetchStatistics = async () => {
    try {
        const {
            userCount, mailCount, sendMailCount,
            addressCount, activeAddressCount7days,
            activeAddressCount30days,
        } = await api.fetch(`/admin/statistics`);
        statistics.value.mailCount = mailCount || 0;
        statistics.value.sendMailCount = sendMailCount || 0;
        statistics.value.userCount = userCount || 0;
        statistics.value.addressCount = addressCount || 0;
        statistics.value.activeAddressCount7days = activeAddressCount7days || 0;
        statistics.value.activeAddressCount30days = activeAddressCount30days || 0;
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

onMounted(async () => {
    await fetchStatistics()
})
</script>

<template>
    <div>
        <n-card :bordered="false" embedded>
            <n-row>

                <n-col :span="8">
                    <n-statistic :label="t('addressCount')" :value="statistics.addressCount">
                        <template #prefix>
                            <n-icon :component="User" />
                        </template>
                    </n-statistic>
                </n-col>
                <n-col :span="8">
                    <n-statistic :label="t('activeAddressCount7days')" :value="statistics.activeAddressCount7days">
                        <template #prefix>
                            <n-icon :component="UserCheck" />
                        </template>
                    </n-statistic>
                </n-col>
                <n-col :span="8">
                    <n-statistic :label="t('activeAddressCount30days')" :value="statistics.activeAddressCount30days">
                        <template #prefix>
                            <n-icon :component="UserCheck" />
                        </template>
                    </n-statistic>
                </n-col>
            </n-row>
        </n-card>
        <n-card :bordered="false" embedded>
            <n-row>
                <n-col :span="8">
                    <n-statistic :label="t('userCount')" :value="statistics.userCount">
                        <template #prefix>
                            <n-icon :component="User" />
                        </template>
                    </n-statistic>
                </n-col>
                <n-col :span="8">
                    <n-statistic :label="t('mailCount')" :value="statistics.mailCount">
                        <template #prefix>
                            <n-icon :component="MailBulk" />
                        </template>
                    </n-statistic>
                </n-col>
                <n-col :span="8">
                    <n-statistic :label="t('sendMailCount')" :value="statistics.sendMailCount">
                        <template #prefix>
                            <n-icon :component="SendOutlined" />
                        </template>
                    </n-statistic>
                </n-col>
            </n-row>
        </n-card>
    </div>
</template>

<style scoped>
.n-card {
    margin-bottom: 20px;
}
</style>
