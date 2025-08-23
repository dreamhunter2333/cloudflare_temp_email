<script setup>
import { onMounted, ref, h } from 'vue';
import { useI18n } from 'vue-i18n'
import { NButton, NPopconfirm, NInput, NSelect } from 'naive-ui'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading, openSettings } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            tip: 'You can manually input the following multiple select input and enter',
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
            domain_list: 'Domain List',
            forward_address: 'Forward Address',
            actions: 'Actions',
            select_domain: 'Select Domain',
            forward_placeholder: 'forward@example.com',
            delete_rule: 'Delete',
            delete_rule_confirm: 'Are you sure you want to delete this rule?',
            delete_success: 'Delete Success',
            forwarding_rule_warning: 'Each rule will run, if domains is empty, all emails will be forwarded, forward address needs to be a verified address',
            add: 'Add',
            cancel: 'Cancel',
            config: 'Config',
        },
        zh: {
            tip: '您可以手动输入以下多选输入框, 回车增加',
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
            domain_list: '域名列表',
            forward_address: '转发地址',
            actions: '操作',
            select_domain: '选择域名',
            forward_placeholder: 'forward@example.com',
            delete_rule: '删除',
            delete_rule_confirm: '确定要删除这条规则吗？',
            delete_success: '删除成功',
            forwarding_rule_warning: '每条规则都会运行，如果 domains 为空，则转发所有邮件，转发地址需要为已验证的地址',
            add: '添加',
            cancel: '取消',
            config: '配置',
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
            forward: ''
        }
    ]
}

const saveEmailForwardingConfig = () => {
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
        emailRuleSettings.value = res.emailRuleSettings || {
            blockReceiveUnknowAddressEmail: false,
            emailForwardingList: []
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
                    :placeholder="t('address_block_list_placeholder')" />
            </n-form-item-row>
            <n-form-item-row :label="t('send_address_block_list')">
                <n-select v-model:value="sendAddressBlockList" filterable multiple tag
                    :placeholder="t('address_block_list_placeholder')" />
            </n-form-item-row>
            <n-form-item-row :label="t('noLimitSendAddressList')">
                <n-select v-model:value="noLimitSendAddressList" filterable multiple tag
                    :placeholder="t('noLimitSendAddressList')" />
            </n-form-item-row>
            <n-form-item-row :label="t('verified_address_list')">
                <n-select v-model:value="verifiedAddressList" filterable multiple tag
                    :placeholder="t('verified_address_list')" />
            </n-form-item-row>
            <n-form-item-row :label="t('fromBlockList')">
                <n-select v-model:value="fromBlockList" filterable multiple tag :placeholder="t('fromBlockList')" />
            </n-form-item-row>
            <n-form-item-row :label="t('block_receive_unknow_address_email')">
                <n-checkbox v-model:checked="emailRuleSettings.blockReceiveUnknowAddressEmail" />
            </n-form-item-row>
            <n-form-item-row :label="t('email_forwarding_config')">
                <n-button @click="openEmailForwardingModal">{{ t('config') }}</n-button>
            </n-form-item-row>
        </n-card>
    </div>

    <!-- 邮件转发配置弹窗 -->
    <n-modal v-model:show="showEmailForwardingModal" preset="card" :title="t('email_forwarding_config')"
        style="max-width: 800px;">
        <n-space vertical>
            <n-alert :show-icon="false" :bordered="false" type="warning">
                <span>{{ t('forwarding_rule_warning') }}</span>
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
