<script setup>
import { onMounted, ref, h } from 'vue';
import { useI18n } from 'vue-i18n'
import { NButton, NPopconfirm, NInput, NSelect, NRadioGroup, NRadio } from 'naive-ui'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading, openSettings } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            tip: 'You can manually input the following multiple select input and enter',
            manualInputPrompt: 'Type and press Enter to add',
            save: 'Save',
            successTip: 'Save Success',
            address_block_list: 'Address Block Keywords for Users(Admin can skip)',
            address_block_list_placeholder: 'Please enter the keywords you want to block',
            send_address_block_list: 'Address Block Keywords for send email',
            noLimitSendAddressList: 'No Balance Limit Send Address List',
            verified_address_list: 'Verified Address List(Can send email by cf internal api)',
            fromBlockList: 'Block Keywords for receive email',
            block_receive_unknow_address_email: 'Block receive unknow address email',
            email_forwarding_config: 'Email Forwarding Configuration',
            domain_list: 'Domain List (Optional)',
            forward_address: 'Forward Address',
            actions: 'Actions',
            select_domain: 'Select Domain',
            forward_placeholder: 'forward@example.com',
            delete_rule: 'Delete',
            delete_rule_confirm: 'Are you sure you want to delete this rule?',
            delete_success: 'Delete Success',
            forwarding_rule_warning: 'Each rule will run independently. Forward address needs to be a verified address.',
            add: 'Add',
            cancel: 'Cancel',
            config: 'Config',
            source_patterns: 'Source Address Regex (Optional)',
            source_patterns_placeholder: 'e.g. gmail.com',
            source_match_mode: 'Match Mode',
            match_any: 'Any',
            match_all: 'All',
            source_patterns_tip: 'Domain list filters by recipient address, source regex filters by sender address. Both conditions must match for forwarding (AND logic). Leave either empty to skip that filter.',
            regex_too_long: 'Regex pattern too long (max 200 characters)',
            regex_invalid: 'Invalid regex pattern',
            forward_address_required: 'Forward address is required',
            rule_index: 'Rule',
        },
        zh: {
            tip: '您可以手动输入以下多选输入框, 回车增加',
            manualInputPrompt: '输入后按回车键添加',
            save: '保存',
            successTip: '保存成功',
            address_block_list: '邮件地址屏蔽关键词(管理员可跳过检查)',
            address_block_list_placeholder: '请输入您想要屏蔽的关键词',
            send_address_block_list: '发送邮件地址屏蔽关键词',
            noLimitSendAddressList: '无余额限制发送地址列表',
            verified_address_list: '已验证地址列表(可通过 cf 内部 api 发送邮件)',
            fromBlockList: '接收邮件地址屏蔽关键词',
            block_receive_unknow_address_email: '禁止接收未知地址邮件',
            email_forwarding_config: '邮件转发配置',
            domain_list: '域名列表（可选）',
            forward_address: '转发地址',
            actions: '操作',
            select_domain: '选择域名',
            forward_placeholder: 'forward@example.com',
            delete_rule: '删除',
            delete_rule_confirm: '确定要删除这条规则吗？',
            delete_success: '删除成功',
            forwarding_rule_warning: '每条规则独立运行，转发地址需要为已验证的地址。',
            add: '添加',
            cancel: '取消',
            config: '配置',
            source_patterns: '来源地址正则（可选）',
            source_patterns_placeholder: '例如: gmail.com',
            source_match_mode: '匹配模式',
            match_any: '任一',
            match_all: '全部',
            source_patterns_tip: '域名列表按收件地址过滤，来源正则按发件地址过滤，两者均为可选。同时配置时需同时满足（AND 逻辑），留空则跳过该条件。',
            regex_too_long: '正则表达式过长（最大200字符）',
            regex_invalid: '无效的正则表达式',
            forward_address_required: '转发地址不能为空',
            rule_index: '规则',
        }
    }
});

const addressBlockList = ref([])
const sendAddressBlockList = ref([])
const noLimitSendAddressList = ref([])
const verifiedAddressList = ref([])
const fromBlockList = ref([])
const emailRuleSettings = ref({
    blockReceiveUnknowAddressEmail: false,
    emailForwardingList: []
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


const fetchData = async () => {
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
    } catch (error) {
        message.error(error.message || "error");
    }
}

const save = async () => {
    try {
        await api.fetch(`/admin/account_settings`, {
            method: 'POST',
            body: JSON.stringify({
                blockList: addressBlockList.value || [],
                sendBlockList: sendAddressBlockList.value || [],
                verifiedAddressList: verifiedAddressList.value || [],
                fromBlockList: fromBlockList.value || [],
                noLimitSendAddressList: noLimitSendAddressList.value || [],
                emailRuleSettings: emailRuleSettings.value,
            })
        })
        message.success(t('successTip'))
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
