<script setup>
import { onMounted, ref } from 'vue';
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading } = useGlobalState()
const message = useMessage()

const { t } = useScopedI18n('views.admin.IpBlacklistSettings')

const enabled = ref(false)
const ipBlacklist = ref([])
const asnBlacklist = ref([])
const fingerprintBlacklist = ref([])
const enableWhitelist = ref(false)
const ipWhitelist = ref([])
const enableDailyLimit = ref(false)
const dailyRequestLimit = ref(1000)

const fetchData = async () => {
    try {
        loading.value = true
        const res = await api.fetch(`/admin/ip_blacklist/settings`)
        enabled.value = res.enabled || false
        ipBlacklist.value = res.blacklist || []
        asnBlacklist.value = res.asnBlacklist || []
        fingerprintBlacklist.value = res.fingerprintBlacklist || []
        enableWhitelist.value = res.enableWhitelist || false
        ipWhitelist.value = res.whitelist || []
        enableDailyLimit.value = res.enableDailyLimit || false
        dailyRequestLimit.value = res.dailyRequestLimit || 1000
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        loading.value = false
    }
}

const save = async () => {
    if (enableWhitelist.value && (!ipWhitelist.value || ipWhitelist.value.length === 0)) {
        message.warning(t('whitelist_empty_warning'))
        return
    }
    try {
        loading.value = true
        await api.fetch(`/admin/ip_blacklist/settings`, {
            method: 'POST',
            body: JSON.stringify({
                enabled: enabled.value,
                blacklist: ipBlacklist.value || [],
                asnBlacklist: asnBlacklist.value || [],
                fingerprintBlacklist: fingerprintBlacklist.value || [],
                enableWhitelist: enableWhitelist.value,
                whitelist: ipWhitelist.value || [],
                enableDailyLimit: enableDailyLimit.value,
                dailyRequestLimit: dailyRequestLimit.value
            })
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        loading.value = false
    }
}

onMounted(async () => {
    await fetchData();
})
</script>

<template>
    <div class="center">
        <n-card :title="t('title')" :bordered="false" embedded style="max-width: 800px;">
            <template #header-extra>
                <n-button @click="save" type="primary" :loading="loading">
                    {{ t('save') }}
                </n-button>
            </template>

            <n-space vertical :size="20">
                <n-alert :show-icon="false" :bordered="false" type="info">
                    <div style="line-height: 1.8;">
                        <div><strong>{{ t("tip_scope") }}</strong></div>
                        <div>• {{ t("tip_whitelist") }}</div>
                        <div>• {{ t("tip_ip") }}</div>
                        <div>• {{ t("tip_asn") }}</div>
                        <div>• {{ t("tip_fingerprint") }}</div>
                        <div>• {{ t("tip_daily_limit") }}</div>
                    </div>
                </n-alert>

                <n-form-item-row :label="t('enable_ip_whitelist')">
                    <n-switch v-model:value="enableWhitelist" :round="false" />
                    <n-text depth="3" style="margin-left: 10px; font-size: 12px;">
                        {{ t('enable_whitelist_tip') }}
                    </n-text>
                </n-form-item-row>

                <n-form-item-row :label="t('ip_whitelist')">
                    <n-select
                        v-model:value="ipWhitelist"
                        filterable
                        multiple
                        tag
                        :placeholder="t('ip_whitelist_placeholder')"
                        :disabled="!enableWhitelist">
                        <template #empty>
                            <n-text depth="3">
                                {{ t('manualInputPrompt') }}
                            </n-text>
                        </template>
                    </n-select>
                </n-form-item-row>

                <n-divider />

                <n-form-item-row :label="t('enable_ip_blacklist')">
                    <n-switch v-model:value="enabled" :round="false" />
                    <n-text depth="3" style="margin-left: 10px; font-size: 12px;">
                        {{ t('enable_tip') }}
                    </n-text>
                </n-form-item-row>

                <n-form-item-row :label="t('ip_blacklist')">
                    <n-select
                        v-model:value="ipBlacklist"
                        filterable
                        multiple
                        tag
                        :placeholder="t('ip_blacklist_placeholder')"
                        :disabled="!enabled">
                        <template #empty>
                            <n-text depth="3">
                                {{ t('manualInputPrompt') }}
                            </n-text>
                        </template>
                    </n-select>
                </n-form-item-row>

                <n-form-item-row :label="t('asn_blacklist')">
                    <n-select
                        v-model:value="asnBlacklist"
                        filterable
                        multiple
                        tag
                        :placeholder="t('asn_blacklist_placeholder')"
                        :disabled="!enabled">
                        <template #empty>
                            <n-text depth="3">
                                {{ t('manualInputPrompt') }}
                            </n-text>
                        </template>
                    </n-select>
                </n-form-item-row>

                <n-form-item-row :label="t('fingerprint_blacklist')">
                    <n-select
                        v-model:value="fingerprintBlacklist"
                        filterable
                        multiple
                        tag
                        :placeholder="t('fingerprint_blacklist_placeholder')"
                        :disabled="!enabled">
                        <template #empty>
                            <n-text depth="3">
                                {{ t('manualInputPrompt') }}
                            </n-text>
                        </template>
                    </n-select>
                </n-form-item-row>

                <n-divider />

                <n-form-item-row :label="t('enable_daily_limit')">
                    <n-switch v-model:value="enableDailyLimit" :round="false" />
                    <n-text depth="3" style="margin-left: 10px; font-size: 12px;">
                        {{ t('enable_daily_limit_tip') }}
                    </n-text>
                </n-form-item-row>

                <n-form-item-row :label="t('daily_request_limit')">
                    <n-input-number
                        v-model:value="dailyRequestLimit"
                        :min="1"
                        :max="1000000"
                        :placeholder="t('daily_request_limit_placeholder')"
                        :disabled="!enableDailyLimit"
                        style="width: 100%;"
                    />
                </n-form-item-row>
            </n-space>
        </n-card>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
    margin: 20px;
}
</style>
