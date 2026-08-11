<script setup>
import { computed, onMounted, ref, h } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { NButton, NPopconfirm, NInput, NSelect, NRadioGroup, NRadio } from 'naive-ui'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading, openSettings } = useGlobalState()
const message = useMessage()

const { t } = useScopedI18n('views.admin.AccountSettings')

const addressBlockList = ref([])
const sendAddressBlockList = ref([])
const noLimitSendAddressList = ref([])
const verifiedAddressList = ref([])
const fromBlockList = ref([])
const emailRuleSettings = ref({
    blockReceiveUnknowAddressEmail: false,
    emailForwardingList: []
})
const ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE = {
    FOLLOW_ENV: 'follow_env',
    FORCE_ENABLE: 'force_enable',
    FORCE_DISABLE: 'force_disable'
}
const DEFAULT_SEND_MAIL_DAILY_LIMIT = 100
const DEFAULT_SEND_MAIL_MONTHLY_LIMIT = 3000
const addressCreationSubdomainMatchMode = ref(ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FOLLOW_ENV)
const sendMailDailyLimitEnabled = ref(false)
const sendMailMonthlyLimitEnabled = ref(false)
const sendMailDailyLimit = ref(DEFAULT_SEND_MAIL_DAILY_LIMIT)
const sendMailMonthlyLimit = ref(DEFAULT_SEND_MAIL_MONTHLY_LIMIT)
const addressCreationSubdomainMatchStatus = ref({
    envConfigured: false,
    envEnabled: false,
    storedEnabled: undefined,
    effectiveEnabled: false
})
const subdomainMatchEnvLocked = computed(() => {
    return addressCreationSubdomainMatchStatus.value.envConfigured
        && !addressCreationSubdomainMatchStatus.value.envEnabled
})
const subdomainMatchModeOptions = computed(() => {
    return [
        {
            value: ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FOLLOW_ENV,
            label: t('create_address_subdomain_match_follow_env')
        },
        {
            value: ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FORCE_ENABLE,
            label: t('create_address_subdomain_match_force_enable')
        },
        {
            value: ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FORCE_DISABLE,
            label: t('create_address_subdomain_match_force_disable')
        }
    ]
})

const showEmailForwardingModal = ref(false)
const emailForwardingList = ref([])


const emailForwardingColumns = [
    {
        title: t('domain_list'),
        key: 'domains',
        render: (row, index) => {
            return h(NSelect, {
                value: Array.isArray(row.domains) ? row.domains : [],
                onUpdateValue: (val) => {
                    emailForwardingList.value[index].domains = val
                },
                options: openSettings.value?.domains || [],
                multiple: true,
                filterable: true,
                tag: true,
                placeholder: t('select_domain')
            })
        }
    },
    {
        title: t('source_patterns'),
        key: 'sourcePatterns',
        render: (row, index) => {
            return h('div', { style: 'display: flex; flex-direction: column; gap: 4px;' }, [
                h(NSelect, {
                    value: Array.isArray(row.sourcePatterns) ? row.sourcePatterns : [],
                    onUpdateValue: (val) => {
                        emailForwardingList.value[index].sourcePatterns = val
                    },
                    multiple: true,
                    filterable: true,
                    tag: true,
                    placeholder: t('source_patterns_placeholder')
                }, {
                    empty: () => h('span', { style: 'color: #999; font-size: 12px;' }, t('manualInputPrompt'))
                }),
                h(NRadioGroup, {
                    value: row.sourceMatchMode || 'any',
                    onUpdateValue: (val) => {
                        emailForwardingList.value[index].sourceMatchMode = val
                    },
                    size: 'small',
                    style: 'margin-top: 4px;'
                }, {
                    default: () => [
                        h(NRadio, { value: 'any' }, { default: () => t('match_any') }),
                        h(NRadio, { value: 'all' }, { default: () => t('match_all') })
                    ]
                })
            ])
        }
    },
    {
        title: t('forward_address'),
        key: 'forward',
        render: (row, index) => {
            return h(NInput, {
                value: row.forward,
                onUpdateValue: (val) => {
                    emailForwardingList.value[index].forward = val
                },
                placeholder: 'forward@example.com'
            })
        }
    },
    {
        title: t('actions'),
        key: 'actions',
        render: (row, index) => {
            return h('div', { style: 'display: flex; gap: 8px;' }, [
                h(NPopconfirm, {
                    onPositiveClick: () => {
                        emailForwardingList.value = emailForwardingList.value.filter((_, i) => i !== index)
                        message.success(t('delete_success'))
                    }
                }, {
                    default: () => t('delete_rule_confirm'),
                    trigger: () => h(NButton, {
                        size: 'small',
                        type: 'error'
                    }, { default: () => t('delete_rule') })
                })
            ])
        }
    }
]

const openEmailForwardingModal = () => {
    // 从 emailRuleSettings 转换出列表数据
    emailForwardingList.value = emailRuleSettings.value.emailForwardingList ?
        [...emailRuleSettings.value.emailForwardingList] : []
    showEmailForwardingModal.value = true
}

const addNewEmailForwardingItem = () => {
    emailForwardingList.value = [
        ...emailForwardingList.value,
        {
            domains: [],
            forward: '',
            sourcePatterns: [],
            sourceMatchMode: 'any'
        }
    ]
}

const MAX_REGEX_LENGTH = 200

const validateForwardingRules = () => {
    for (let i = 0; i < emailForwardingList.value.length; i++) {
        const rule = emailForwardingList.value[i]

        // 验证转发地址
        if (!rule.forward || rule.forward.trim() === '') {
            message.error(`${t('forward_address_required')} (${t('rule_index')} ${i + 1})`)
            return false
        }

        // 验证正则表达式
        if (rule.sourcePatterns && rule.sourcePatterns.length > 0) {
            for (const pattern of rule.sourcePatterns) {
                // 检查长度
                if (pattern.length > MAX_REGEX_LENGTH) {
                    message.error(`${t('regex_too_long')}: ${pattern.substring(0, 30)}...`)
                    return false
                }
                // 检查正则有效性
                try {
                    new RegExp(pattern, 'i')
                } catch (e) {
                    message.error(`${t('regex_invalid')}: ${pattern}`)
                    return false
                }
            }
        }
    }
    return true
}

const saveEmailForwardingConfig = () => {
    if (!validateForwardingRules()) {
        return
    }
    emailRuleSettings.value.emailForwardingList = [...emailForwardingList.value]
    showEmailForwardingModal.value = false
}

const getSubdomainMatchModeByStoredValue = (storedEnabled) => {
    if (storedEnabled === true) {
        return ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FORCE_ENABLE
    }
    if (storedEnabled === false) {
        return ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FORCE_DISABLE
    }
    return ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FOLLOW_ENV
}

const getSubdomainMatchPayloadValue = (mode) => {
    if (mode === ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FORCE_ENABLE) {
        return true
    }
    if (mode === ADDRESS_CREATION_SUBDOMAIN_MATCH_MODE.FORCE_DISABLE) {
        return false
    }
    return null
}

const getSendMailLimitPayload = () => {
    return {
        dailyEnabled: sendMailDailyLimitEnabled.value,
        monthlyEnabled: sendMailMonthlyLimitEnabled.value,
        dailyLimit: sendMailDailyLimitEnabled.value ? sendMailDailyLimit.value : null,
        monthlyLimit: sendMailMonthlyLimitEnabled.value ? sendMailMonthlyLimit.value : null
    }
}

const isValidSendMailLimit = (value) => {
    return Number.isInteger(value) && value >= -1
}

const validateSendMailLimit = () => {
    if (sendMailDailyLimitEnabled.value && !isValidSendMailLimit(sendMailDailyLimit.value)) {
        message.error(t('send_mail_daily_limit_invalid'))
        return false
    }
    if (sendMailMonthlyLimitEnabled.value && !isValidSendMailLimit(sendMailMonthlyLimit.value)) {
        message.error(t('send_mail_monthly_limit_invalid'))
        return false
    }
    return true
}

const fetchData = async ({ suppressErrorMessage = false } = {}) => {
    try {
        const res = await api.fetch(`/admin/account_settings`)
        addressBlockList.value = res.blockList || []
        sendAddressBlockList.value = res.sendBlockList || []
        verifiedAddressList.value = res.verifiedAddressList || []
        fromBlockList.value = res.fromBlockList || []
        noLimitSendAddressList.value = res.noLimitSendAddressList || []
        emailRuleSettings.value = {
            blockReceiveUnknowAddressEmail: res.emailRuleSettings?.blockReceiveUnknowAddressEmail || false,
            emailForwardingList: res.emailRuleSettings?.emailForwardingList || []
        }
        addressCreationSubdomainMatchStatus.value = {
            envConfigured: !!res.addressCreationSubdomainMatchStatus?.envConfigured,
            envEnabled: !!res.addressCreationSubdomainMatchStatus?.envEnabled,
            storedEnabled: typeof res.addressCreationSubdomainMatchStatus?.storedEnabled === 'boolean'
                ? res.addressCreationSubdomainMatchStatus.storedEnabled
                : undefined,
            effectiveEnabled: !!res.addressCreationSubdomainMatchStatus?.effectiveEnabled
        }
        addressCreationSubdomainMatchMode.value = getSubdomainMatchModeByStoredValue(
            addressCreationSubdomainMatchStatus.value.storedEnabled
        )
        const sendMailLimitConfig = res.sendMailLimitConfig
        sendMailDailyLimitEnabled.value = !!sendMailLimitConfig?.dailyEnabled
        sendMailMonthlyLimitEnabled.value = !!sendMailLimitConfig?.monthlyEnabled
        sendMailDailyLimit.value = sendMailDailyLimitEnabled.value
            ? sendMailLimitConfig.dailyLimit
            : DEFAULT_SEND_MAIL_DAILY_LIMIT
        sendMailMonthlyLimit.value = sendMailMonthlyLimitEnabled.value
            ? sendMailLimitConfig.monthlyLimit
            : DEFAULT_SEND_MAIL_MONTHLY_LIMIT
    } catch (error) {
        if (!suppressErrorMessage) {
            message.error(error.message || "error");
        }
        throw error
    }
}

const save = async () => {
    if (!validateSendMailLimit()) {
        return
    }
    try {
        const payload = {
            blockList: addressBlockList.value || [],
            sendBlockList: sendAddressBlockList.value || [],
            verifiedAddressList: verifiedAddressList.value || [],
            fromBlockList: fromBlockList.value || [],
            noLimitSendAddressList: noLimitSendAddressList.value || [],
            emailRuleSettings: emailRuleSettings.value,
            addressCreationSettings: {
                enableSubdomainMatch: getSubdomainMatchPayloadValue(addressCreationSubdomainMatchMode.value)
            },
            sendMailLimitConfig: getSendMailLimitPayload()
        }
        await api.fetch(`/admin/account_settings`, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        message.success(t('successTip'))
    } catch (error) {
        message.error(error.message || "error");
        return
    }

    try {
        await fetchData({ suppressErrorMessage: true })
    } catch (error) {
        console.warn('Failed to refresh account settings after save', error)
        message.warning(error.message || "error");
    }
}


onMounted(async () => {
    try {
        await fetchData();
    } catch {
        // 首次加载失败时，错误提示已经在 fetchData 内部统一处理，这里无需重复提示。
    }
})
</script>

<template>
    <div class="center">
        <n-card :bordered="false" embedded style="max-width: 600px;">
            <n-alert :show-icon="false" :bordered="false" type="warning" style="margin-bottom: 10px;">
                <span>{{ t("tip") }}</span>
            </n-alert>
            <n-flex justify="end">
                <n-button @click="save" type="primary" :loading="loading">
                    {{ t('save') }}
                </n-button>
            </n-flex>
            <n-form-item-row :label="t('address_block_list')">
                <n-select v-model:value="addressBlockList" filterable multiple tag
                    :placeholder="t('address_block_list_placeholder')">
                    <template #empty>
                        <n-text depth="3">
                            {{ t('manualInputPrompt') }}
                        </n-text>
                    </template>
                </n-select>
            </n-form-item-row>
            <n-form-item-row :label="t('send_address_block_list')">
                <n-select v-model:value="sendAddressBlockList" filterable multiple tag
                    :placeholder="t('address_block_list_placeholder')">
                    <template #empty>
                        <n-text depth="3">
                            {{ t('manualInputPrompt') }}
                        </n-text>
                    </template>
                </n-select>
            </n-form-item-row>
            <n-form-item-row :label="t('noLimitSendAddressList')">
                <n-select v-model:value="noLimitSendAddressList" filterable multiple tag
                    :placeholder="t('noLimitSendAddressList')">
                    <template #empty>
                        <n-text depth="3">
                            {{ t('manualInputPrompt') }}
                        </n-text>
                    </template>
                </n-select>
            </n-form-item-row>
            <n-form-item-row :label="t('verified_address_list')">
                <n-select v-model:value="verifiedAddressList" filterable multiple tag
                    :placeholder="t('verified_address_list')">
                    <template #empty>
                        <n-text depth="3">
                            {{ t('manualInputPrompt') }}
                        </n-text>
                    </template>
                </n-select>
            </n-form-item-row>
            <n-form-item-row :label="t('send_mail_limit')">
                <n-flex vertical style="width: 100%;">
                    <n-flex justify="space-between" align="center">
                        <n-text>{{ t('send_mail_daily_limit') }}</n-text>
                        <n-flex align="center">
                            <n-switch v-model:value="sendMailDailyLimitEnabled" :round="false" />
                            <n-input-number
                                v-model:value="sendMailDailyLimit"
                                :disabled="!sendMailDailyLimitEnabled"
                                :min="-1"
                            />
                        </n-flex>
                    </n-flex>
                    <n-flex justify="space-between" align="center">
                        <n-text>{{ t('send_mail_monthly_limit') }}</n-text>
                        <n-flex align="center">
                            <n-switch v-model:value="sendMailMonthlyLimitEnabled" :round="false" />
                            <n-input-number
                                v-model:value="sendMailMonthlyLimit"
                                :disabled="!sendMailMonthlyLimitEnabled"
                                :min="-1"
                            />
                        </n-flex>
                    </n-flex>
                    <n-text depth="3">
                        {{ t('send_mail_limit_tip') }}
                    </n-text>
                </n-flex>
            </n-form-item-row>
            <n-form-item-row :label="t('fromBlockList')">
                <n-select v-model:value="fromBlockList" filterable multiple tag :placeholder="t('fromBlockList')">
                    <template #empty>
                        <n-text depth="3">
                            {{ t('manualInputPrompt') }}
                        </n-text>
                    </template>
                </n-select>
            </n-form-item-row>
            <n-form-item-row :label="t('block_receive_unknow_address_email')">
                <n-switch v-model:value="emailRuleSettings.blockReceiveUnknowAddressEmail" :round="false" />
            </n-form-item-row>
            <n-form-item-row :label="t('create_address_subdomain_match')">
                <n-flex vertical style="width: 100%;">
                    <n-radio-group v-model:value="addressCreationSubdomainMatchMode">
                        <n-space vertical size="small">
                            <n-radio v-for="item in subdomainMatchModeOptions" :key="item.value" :value="item.value">
                                {{ item.label }}
                            </n-radio>
                        </n-space>
                    </n-radio-group>
                    <n-text depth="3">
                        {{ t('create_address_subdomain_match_tip') }}
                    </n-text>
                    <n-text depth="3">
                        {{ t('create_address_subdomain_match_note') }}
                    </n-text>
                    <n-text depth="3">
                        {{ t('create_address_subdomain_match_follow_env_note') }}
                    </n-text>
                    <n-alert v-if="subdomainMatchEnvLocked" type="warning" :show-icon="false" :bordered="false">
                        {{ t('create_address_subdomain_match_env_locked') }}
                    </n-alert>
                </n-flex>
            </n-form-item-row>
            <n-form-item-row :label="t('email_forwarding_config')">
                <n-button @click="openEmailForwardingModal">{{ t('config') }}</n-button>
            </n-form-item-row>
        </n-card>
    </div>

    <!-- 邮件转发配置弹窗 -->
    <n-modal v-model:show="showEmailForwardingModal" preset="card" :title="t('email_forwarding_config')"
        style="max-width: 1000px;">
        <n-space vertical>
            <n-alert :show-icon="false" :bordered="false" type="warning">
                <span>{{ t('forwarding_rule_warning') }}</span>
                <br />
                <span>{{ t('source_patterns_tip') }}</span>
            </n-alert>
            <n-space justify="end">
                <n-button @click="addNewEmailForwardingItem">{{ t('add') }}</n-button>
            </n-space>
            <n-data-table :columns="emailForwardingColumns" :data="emailForwardingList" :bordered="false" striped />
            <n-space justify="end">
                <n-button @click="saveEmailForwardingConfig" type="primary">{{ t('save') }}</n-button>
            </n-space>
        </n-space>
    </n-modal>
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
