<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import { api } from '../../api'

const { localeCache } = useGlobalState()
// @ts-ignore
const message = useMessage()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            init: 'Init',
            successTip: 'Success',
            status: 'Check Status',
            enableTelegramAllowList: 'Enable Telegram Allow List(Manually input user ID)',
            enable: 'Enable',
            telegramAllowList: 'Telegram Allow List',
            save: 'Save',
        },
        zh: {
            init: '初始化',
            successTip: '成功',
            status: '查看状态',
            enableTelegramAllowList: '启用 Telegram 白名单(手动输入用户 ID)',
            enable: '启用',
            telegramAllowList: 'Telegram 白名单',
            save: '保存',
        }
    }
});

const status = ref({
    fetched: false,
})

const fetchStatus = async () => {
    try {
        const res = await api.fetch(`/admin/telegram/status`)
        Object.assign(status.value, res)
        status.value.fetched = true
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const init = async () => {
    try {
        await api.fetch(`/admin/telegram/init`, {
            method: 'POST',
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

class TelegramSettings {
    enableAllowList: boolean;
    allowList: string[];

    constructor(enableAllowList: boolean, allowList: string[]) {
        this.enableAllowList = enableAllowList;
        this.allowList = allowList;
    }
}

const settings = ref(new TelegramSettings(false, []))

const getSettings = async () => {
    try {
        const res = await api.fetch(`/admin/telegram/settings`)
        Object.assign(settings.value, res)
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

const saveSettings = async () => {
    try {
        await api.fetch(`/admin/telegram/settings`, {
            method: 'POST',
            body: JSON.stringify(settings.value),
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error((error as Error).message || "error");
    }
}

onMounted(async () => {
    await getSettings();
})
</script>

<template>
    <div class="center">
        <n-card style="max-width: 800px; overflow: auto;">
            <n-card>
                <n-form-item-row :label="t('enableTelegramAllowList')">
                    <n-input-group>
                        <n-checkbox v-model:checked="settings.enableAllowList" style="width: 20%;">
                            {{ t('enable') }}
                        </n-checkbox>
                        <n-select v-model:value="settings.allowList" filterable multiple tag style="width: 80%;"
                            :placeholder="t('telegramAllowList')" />
                    </n-input-group>
                </n-form-item-row>
                <n-button @click="saveSettings" type="primary" block>
                    {{ t('save') }}
                </n-button>
            </n-card>
            <n-button @click="init" type="primary" block>
                {{ t('init') }}
            </n-button>
            <n-button @click="fetchStatus" secondary block>
                {{ t('status') }}
            </n-button>
            <pre v-if="status.fetched">{{ JSON.stringify(status, null, 2) }}</pre>
        </n-card>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
}

.n-button {
    margin-top: 10px;
}
</style>
