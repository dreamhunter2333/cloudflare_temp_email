<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { api } from '../../api'
import { useGlobalState } from '../../store'
import SendBox from '../../components/SendBox.vue'

const SendMail = defineAsyncComponent(() => import('../index/SendMail.vue'))

const ADDRESS_PAGE_SIZE = 100

const message = useMessage()
const { openSettings } = useGlobalState()
const { t } = useScopedI18n('views.user.UserMailClient')

const addressId = ref(null)
const addressOptions = ref([])
const addressCount = ref(0)
const addressLoading = ref(false)
const mailTab = ref('send_mail')

const hasMoreAddresses = computed(() => addressOptions.value.length < addressCount.value)

const fetchAddresses = async () => {
    if (addressLoading.value || (!hasMoreAddresses.value && addressOptions.value.length > 0)) {
        return
    }
    addressLoading.value = true
    try {
        const offset = addressOptions.value.length
        const { results, count } = await api.fetch(
            `/user_api/bind_address?limit=${ADDRESS_PAGE_SIZE}&offset=${offset}`
        )
        addressOptions.value.push(...results.map((address) => ({
            label: address.name,
            value: address.id,
        })))
        if (offset === 0) {
            addressCount.value = count
        }
    } catch (error) {
        message.error(error.message || 'error')
    } finally {
        addressLoading.value = false
    }
}

const handleAddressScroll = async (event) => {
    const target = event.currentTarget
    if (!target || target.scrollTop + target.clientHeight < target.scrollHeight - 24) {
        return
    }
    await fetchAddresses()
}

const fetchSendbox = async (limit, offset) => {
    return await api.fetch(
        `/user_api/address/${addressId.value}/sendbox?limit=${limit}&offset=${offset}`
    )
}

const deleteSendboxMail = async (mailId) => {
    await api.fetch(
        `/user_api/address/${addressId.value}/sendbox/${mailId}`,
        { method: 'DELETE' }
    )
}

onMounted(fetchAddresses)
</script>

<template>
    <div class="user-mail-client">
        <n-card class="address-picker" :bordered="false" embedded size="small">
            <n-flex align="center" justify="space-between" :wrap="true">
                <div class="address-picker-copy">
                    <n-text strong>{{ t('selectAddress') }}</n-text>
                    <n-text depth="3">{{ t('selectAddressTip') }}</n-text>
                </div>
                <n-select v-model:value="addressId" class="address-picker-select" :options="addressOptions"
                    :loading="addressLoading" :placeholder="t('selectAddress')" filterable clearable
                    @scroll="handleAddressScroll" />
            </n-flex>
        </n-card>

        <n-empty v-if="!addressId" class="address-empty" :description="t('noAddress')" />

        <n-tabs v-else v-model:value="mailTab" type="line" animated>
            <n-tab-pane name="send_mail" :tab="t('sendMail')" display-directive="show:lazy">
                <SendMail :key="addressId" :address-id="addressId" @sent="mailTab = 'sendbox'" />
            </n-tab-pane>
            <n-tab-pane name="sendbox" :tab="t('sendbox')" display-directive="show:lazy">
                <SendBox :key="addressId" :fetch-mail-data="fetchSendbox"
                    :enable-user-delete-email="openSettings.enableUserDeleteEmail"
                    :delete-mail="deleteSendboxMail" />
            </n-tab-pane>
        </n-tabs>
    </div>
</template>

<style scoped>
.user-mail-client {
    padding-top: 10px;
    text-align: left;
}

.address-picker {
    margin-bottom: 10px;
}

.address-picker-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.address-picker-select {
    width: min(420px, 100%);
}

.address-empty {
    padding: 72px 0;
}

@media (max-width: 640px) {
    .address-picker-select {
        width: 100%;
    }
}
</style>
