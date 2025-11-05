<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            title: 'IP Blacklist Settings',
            manualInputPrompt: 'Type pattern and press Enter to add',
            save: 'Save',
            successTip: 'Save Success',
            enable_ip_blacklist: 'Enable IP Blacklist',
            enable_tip: 'Block IPs matching blacklist patterns from accessing rate-limited APIs',
            ip_blacklist: 'IP Blacklist Patterns',
            ip_blacklist_placeholder: 'Enter pattern (e.g., 192.168.1 or ^10\\.0\\.0\\.5$)',
            asn_blacklist: 'ASN Organization Blacklist',
            asn_blacklist_placeholder: 'Enter ASN organization (e.g., Google, Amazon)',
            fingerprint_blacklist: 'Browser Fingerprint Blacklist',
            fingerprint_blacklist_placeholder: 'Enter fingerprint ID (e.g., a1b2c3d4e5f6g7h8)',
            tip_ip: 'IP Blacklist: Supports text matching (e.g., "192.168.1") or regex (e.g., "^10\\.0\\.0\\.5$").',
            tip_asn: 'ASN Organization: Block by ISP/provider. Case-insensitive text matching or regex.',
            tip_fingerprint: 'Browser Fingerprint: Block by browser fingerprint. Supports exact matching or regex patterns.',
        },
        zh: {
            title: 'IP 黑名单设置',
            manualInputPrompt: '输入匹配模式后按回车键添加',
            save: '保存',
            successTip: '保存成功',
            enable_ip_blacklist: '启用 IP 黑名单',
            enable_tip: '阻止匹配黑名单的 IP 访问限流 API',
            ip_blacklist: 'IP 黑名单匹配模式',
            ip_blacklist_placeholder: '输入匹配模式（例如：192.168.1 或 ^10\\.0\\.0\\.5$）',
            asn_blacklist: 'ASN 组织（运营商）黑名单',
            asn_blacklist_placeholder: '输入 ASN 组织名称（例如：Google, Amazon）',
            fingerprint_blacklist: '浏览器指纹黑名单',
            fingerprint_blacklist_placeholder: '输入指纹 ID（例如：a1b2c3d4e5f6g7h8）',
            tip_ip: 'IP 黑名单：支持文本匹配（如 "192.168.1"）或正则表达式（如 "^10\\.0\\.0\\.5$"）。',
            tip_asn: 'ASN 组织：根据运营商/ISP 拉黑。支持不区分大小写的文本匹配或正则表达式。',
            tip_fingerprint: '浏览器指纹：根据浏览器指纹拉黑。支持完全匹配或正则表达式。',
        }
    }
});

const enabled = ref(false)
const ipBlacklist = ref([])
const asnBlacklist = ref([])
const fingerprintBlacklist = ref([])

const fetchData = async () => {
    try {
        loading.value = true
        const res = await api.fetch(`/admin/ip_blacklist/settings`)
        enabled.value = res.enabled || false
        ipBlacklist.value = res.blacklist || []
        asnBlacklist.value = res.asnBlacklist || []
        fingerprintBlacklist.value = res.fingerprintBlacklist || []
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        loading.value = false
    }
}

const save = async () => {
    try {
        loading.value = true
        await api.fetch(`/admin/ip_blacklist/settings`, {
            method: 'POST',
            body: JSON.stringify({
                enabled: enabled.value,
                blacklist: ipBlacklist.value || [],
                asnBlacklist: asnBlacklist.value || [],
                fingerprintBlacklist: fingerprintBlacklist.value || [],
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
                        <div>• {{ t("tip_ip") }}</div>
                        <div>• {{ t("tip_asn") }}</div>
                        <div>• {{ t("tip_fingerprint") }}</div>
                    </div>
                </n-alert>

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
