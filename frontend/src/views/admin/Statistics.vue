<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'
import { User, UserCheck, MailBulk } from '@vicons/fa'
import { SendOutlined } from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { adminAuth } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            userCount: 'Account Count',
            activeUser: '7 days Active Mail Account',
            mailCount: 'Mail Count',
            sendMailCount: 'Send Mail Count'
        },
        zh: {
            userCount: '地址总数',
            activeUser: '周活跃邮箱地址',
            mailCount: '邮件总数',
            sendMailCount: '发送邮件总数'
        }
    }
});

const statistics = ref({
    userCount: 0,
    mailCount: 0,
    activeUserCount7days: 0,
    sendMailCount: 0,
})

const fetchStatistics = async () => {
    try {
        const {
            userCount, activeUserCount7days, mailCount, sendMailCount
        } = await api.fetch(`/admin/statistics`);
        statistics.value.mailCount = mailCount || 0;
        statistics.value.userCount = userCount || 0;
        statistics.value.activeUserCount7days = activeUserCount7days || 0;
        statistics.value.sendMailCount = sendMailCount || 0;
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

onMounted(async () => {
    if (!adminAuth.value) {
        return;
    }
    await fetchStatistics()
})
</script>

<template>
    <n-card>
        <n-row>
            <n-col :span="6">
                <n-statistic :label="t('userCount')" :value="statistics.userCount">
                    <template #prefix>
                        <n-icon :component="User" />
                    </template>
                </n-statistic>
            </n-col>
            <n-col :span="6">
                <n-statistic :label="t('activeUser')" :value="statistics.activeUserCount7days">
                    <template #prefix>
                        <n-icon :component="UserCheck" />
                    </template>
                </n-statistic>
            </n-col>
            <n-col :span="6">
                <n-statistic :label="t('mailCount')" :value="statistics.mailCount">
                    <template #prefix>
                        <n-icon :component="MailBulk" />
                    </template>
                </n-statistic>
            </n-col>
            <n-col :span="6">
                <n-statistic :label="t('sendMailCount')" :value="statistics.sendMailCount">
                    <template #prefix>
                        <n-icon :component="SendOutlined" />
                    </template>
                </n-statistic>
            </n-col>
        </n-row>
    </n-card>
</template>
