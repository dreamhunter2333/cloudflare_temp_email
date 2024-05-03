<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { localeCache, loading } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
    locale: localeCache.value || 'zh',
    messages: {
        en: {
            save: 'Save',
            successTip: 'Save Success',
            address_block_list: 'Address Block Keywords for Users(Admin can skip)',
            address_block_list_placeholder: 'Please enter the keywords you want to block',
        },
        zh: {
            save: '保存',
            successTip: '保存成功',
            address_block_list: '用户地址屏蔽关键词(管理员可跳过检查)',
            address_block_list_placeholder: '请输入您想要屏蔽的关键词',
        }
    }
});

const addressBlockList = ref([])

const fetchData = async () => {
    try {
        const res = await api.fetch(`/admin/account_settings`)
        addressBlockList.value = res.blockList || []
    } catch (error) {
        message.error(error.message || "error");
    }
}

const save = async () => {
    try {
        await api.fetch(`/admin/account_settings`, {
            method: 'POST',
            body: JSON.stringify({
                blockList: addressBlockList.value || []
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
        <n-card style="max-width: 600px;">
            <n-form-item-row :label="t('address_block_list')">
                <n-select v-model:value="addressBlockList" filterable multiple tag
                    :placeholder="t('address_block_list_placeholder')" />
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
