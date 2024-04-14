<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'
import { CleaningServicesFilled } from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { localeCache, adminAuth, showAdminAuth } = useGlobalState()
const message = useMessage()
const cleanMailsDays = ref(30)
const cleanUnknowMailsDays = ref(30)
const cleanAddressDays = ref(30)
const cleanSendBoxDays = ref(30)

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            tip: 'Please input the cleanup days',
            mailBoxTip: "Clean up {day} days ago mailbox",
            mailUnknowTip: "Clean up {day} days ago mails with unknow receiver",
            addressUnActiveTip: "Clean up {day} days ago unactive address",
            sendBoxTip: "Clean up {day} days ago sendbox",
            cleanupSuccess: "Cleanup success",
        },
        zh: {
            tip: '请输入清理天数',
            mailBoxTip: "清理{day}天前的收件箱",
            mailUnknowTip: "清理{day}天前的无收件人邮件",
            addressUnActiveTip: "清理{day}天前的未活动地址",
            sendBoxTip: "清理{day}天前的发件箱",
            cleanupSuccess: "清理成功",
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

onMounted(async () => {
    if (!adminAuth.value) {
        showAdminAuth.value = true;
        return;
    }
})
</script>


<template>
    <div class="center">
        <n-card>
            <div class="item">
                <n-input-number v-model:value="cleanMailsDays" :placeholder="t('tip')" />
                <n-button @click="cleanup('mails', cleanMailsDays)">
                    <template #icon>
                        <n-icon :component="CleaningServicesFilled" />
                    </template>
                    {{ t('mailBoxTip', { day: cleanMailsDays }) }}
                </n-button>
            </div>
            <div class="item">
                <n-input-number v-model:value="cleanUnknowMailsDays" :placeholder="t('tip')" />
                <n-button @click="cleanup('mails_unknow', cleanUnknowMailsDays)">
                    <template #icon>
                        <n-icon :component="CleaningServicesFilled" />
                    </template>
                    {{ t('mailUnknowTip', { day: cleanUnknowMailsDays }) }}
                </n-button>
            </div>
            <div class="item">
                <n-input-number v-model:value="cleanAddressDays" :placeholder="t('tip')" />
                <n-button @click="cleanup('address', cleanAddressDays)">
                    <template #icon>
                        <n-icon :component="CleaningServicesFilled" />
                    </template>
                    {{ t('addressUnActiveTip', { day: cleanAddressDays }) }}
                </n-button>
            </div>
            <div class="item">
                <n-input-number v-model:value="cleanSendBoxDays" :placeholder="t('tip')" />
                <n-button @click="cleanup('sendbox', cleanSendBoxDays)">
                    <template #icon>
                        <n-icon :component="CleaningServicesFilled" />
                    </template>
                    {{ t('sendBoxTip', { day: cleanSendBoxDays }) }}
                </n-button>
            </div>
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

.item {
    display: flex;
    margin: 10px;
}
</style>
