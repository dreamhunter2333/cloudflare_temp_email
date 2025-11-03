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
            tip: 'Block specific IPs from accessing rate-limited APIs. Supports text matching (e.g., "192.168.1") or regex (e.g., "^10\\.0\\.0\\.5$").',
            manualInputPrompt: 'Type pattern and press Enter to add',
            save: 'Save',
            successTip: 'Save Success',
            enable_ip_blacklist: 'Enable IP Blacklist',
            enable_tip: 'Block IPs matching blacklist patterns from accessing rate-limited APIs',
            ip_blacklist: 'IP Blacklist Patterns',
            ip_blacklist_placeholder: 'Enter pattern (e.g., 192.168.1 or ^10\\.0\\.0\\.5$)',
            asn_blacklist: 'ASN Organization Blacklist',
            asn_blacklist_placeholder: 'Enter ASN organization (e.g., Google, Amazon)',
            asn_tip: 'Block by ASN organization (ISP/provider). Case-insensitive text matching or regex.',
        },
        zh: {
            title: 'IP 黑名单设置',
            tip: '阻止特定 IP 访问限流 API。支持文本匹配（如 "192.168.1"）或正则表达式（如 "^10\\.0\\.0\\.5$"）。',
            manualInputPrompt: '输入匹配模式后按回车键添加',
            save: '保存',
            successTip: '保存成功',
            enable_ip_blacklist: '启用 IP 黑名单',
            enable_tip: '阻止匹配黑名单的 IP 访问限流 API',
            ip_blacklist: 'IP 黑名单匹配模式',
            ip_blacklist_placeholder: '输入匹配模式（例如：192.168.1 或 ^10\\.0\\.0\\.5$）',
            asn_blacklist: 'ASN 组织（运营商）黑名单',
            asn_blacklist_placeholder: '输入 ASN 组织名称（例如：Google, Amazon）',
            asn_tip: '根据 ASN 组织（运营商/ISP）拉黑。支持不区分大小写的文本匹配或正则表达式。',
        }
    }
});

const enabled = ref(false)
const ipBlacklist = ref([])
const asnBlacklist = ref([])

const fetchData = async () => {
    try {
        loading.value = true
        const res = await api.fetch(`/admin/ip_blacklist/settings`)
        enabled.value = res.enabled || false
        ipBlacklist.value = res.blacklist || []
        asnBlacklist.value = res.asnBlacklist || []
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
                    <span>{{ t("tip") }}</span>
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

                <n-alert :show-icon="false" :bordered="false" type="default">
                    <n-text depth="3" style="font-size: 12px;">
                        {{ t('asn_tip') }}
                    </n-text>
                </n-alert>
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
