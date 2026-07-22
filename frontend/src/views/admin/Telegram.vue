<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import { api } from '../../api'
// @ts-ignore
const message = useMessage()

const { t } = useScopedI18n('views.admin.Telegram')

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
    miniAppUrl: string;
    enableGlobalMailPush: boolean;
    globalMailPushList: string[];

    constructor(
        enableAllowList: boolean, allowList: string[], miniAppUrl: string,
        enableGlobalMailPush: boolean, globalMailPushList: string[]
    ) {
        this.enableAllowList = enableAllowList;
        this.allowList = allowList;
        this.miniAppUrl = miniAppUrl;
        this.enableGlobalMailPush = enableGlobalMailPush;
        this.globalMailPushList = globalMailPushList;
    }
}

const settings = ref(new TelegramSettings(false, [], '', false, []))

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
        <n-card :bordered="false" embedded style="max-width: 800px; overflow: auto;">
            <n-flex justify="end">
                <n-button @click="fetchStatus" secondary>
                    {{ t('status') }}
                </n-button>
                <n-button @click="init" type="primary">
                    {{ t('init') }}
                </n-button>
                <n-button @click="saveSettings" type="primary">
                    {{ t('save') }}
                </n-button>
            </n-flex>
            <n-card :bordered="false" embedded>
                <n-form-item-row :label="t('enableTelegramAllowList')">
                    <n-input-group>
                        <n-checkbox v-model:checked="settings.enableAllowList" style="width: 20%;">
                            {{ t('enable') }}
                        </n-checkbox>
                        <n-select v-model:value="settings.allowList" filterable multiple tag style="width: 80%;"
                            :placeholder="t('telegramAllowList')">
                            <template #empty>
                                <n-text depth="3">
                                    {{ t('manualInputPrompt') }}
                                </n-text>
                            </template>
                        </n-select>
                    </n-input-group>
                </n-form-item-row>
                <br />
                <n-form-item-row :label="t('enableGlobalMailPush')">
                    <n-input-group>
                        <n-checkbox v-model:checked="settings.enableGlobalMailPush" style="width: 20%;">
                            {{ t('enable') }}
                        </n-checkbox>
                        <n-select v-model:value="settings.globalMailPushList" filterable multiple tag
                            style="width: 80%;" :placeholder="t('globalMailPushList')">
                            <template #empty>
                                <n-text depth="3">
                                    {{ t('manualInputPrompt') }}
                                </n-text>
                            </template>
                        </n-select>
                    </n-input-group>
                    <template #feedback>
                        <n-text depth="3">
                            {{ t('globalMailPushListTip') }}
                        </n-text>
                    </template>
                </n-form-item-row>
                <br />
                <n-form-item-row :label="t('miniAppUrl')">
                    <n-input v-model:value="settings.miniAppUrl"></n-input>
                </n-form-item-row>
            </n-card>
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
</style>
