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
            tip: 'You can manually input the following multiple select input and enter',
            save: 'Save',
            successTip: 'Save Success',
            address_block_list: 'Address Block Keywords for Users(Admin can skip)',
            address_block_list_placeholder: 'Please enter the keywords you want to block',
            send_address_block_list: 'Address Block Keywords for send email',
            noLimitSendAddressList: 'No Balance Limit Send Address List',
            verified_address_list: 'Verified Address List(Can send email by cf internal api)',
            fromBlockList: 'Block Keywords for receive email',
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
        }
    }
});

const addressBlockList = ref([])
const sendAddressBlockList = ref([])
const noLimitSendAddressList = ref([])
const verifiedAddressList = ref([])
const fromBlockList = ref([])

const fetchData = async () => {
    try {
        const res = await api.fetch(`/admin/account_settings`)
        addressBlockList.value = res.blockList || []
        sendAddressBlockList.value = res.sendBlockList || []
        verifiedAddressList.value = res.verifiedAddressList || []
        fromBlockList.value = res.fromBlockList || []
        noLimitSendAddressList.value = res.noLimitSendAddressList || []
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
            <n-alert :show-icon="false" type="warning" style="margin-bottom: 10px;">
                {{ t("tip") }}
            </n-alert>
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
            <n-button @click="save" type="primary" block :loading="loading">
                {{ t('save') }}
            </n-button>
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
