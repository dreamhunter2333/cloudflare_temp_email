<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { api } from '../../api'
import { useGlobalState } from '../../store'
import SendBox from '../../components/SendBox.vue'

const SendMail = defineAsyncComponent(() => import('./SendMail.vue'))

const ADDRESS_PAGE_SIZE = 100

const props = defineProps({
    mode: {
        type: String,
        default: 'send_mail',
    },
})

const emit = defineEmits(['sent'])

const message = useMessage()
const { openSettings } = useGlobalState()
const { t } = useScopedI18n('views.user.UserSendBox')
const { t: mailboxT } = useScopedI18n('views.user.UserMailBox')

const selectedAddressId = ref(null)
const addressFilter = ref(null)
const addressOptions = ref([])
const addressCount = ref(0)
const addressLoading = ref(false)
const sendboxKey = ref(0)

const hasMoreAddresses = computed(() => addressOptions.value.length < addressCount.value)
const addressFilterOptions = computed(() => addressOptions.value.map((address) => ({
    label: address.label,
    value: address.address,
})))

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
            address: address.name,
        })))
        if (offset === 0) {
            addressCount.value = count
        }
        if (props.mode === 'send_mail' && !selectedAddressId.value && addressOptions.value.length > 0) {
            selectedAddressId.value = addressOptions.value[0].value
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
        `/user_api/sendbox?limit=${limit}&offset=${offset}`
        + (addressFilter.value ? `&address=${encodeURIComponent(addressFilter.value)}` : '')
    )
}

const deleteSendboxMail = async (mailId) => {
    await api.fetch(`/user_api/sendbox/${mailId}`, { method: 'DELETE' })
}

const querySendbox = () => {
    sendboxKey.value = Date.now()
}

watch(addressFilter, querySendbox)

onMounted(fetchAddresses)
</script>

<template>
    <div class="user-send-box">
        <template v-if="mode === 'send_mail'">
            <n-empty v-if="!selectedAddressId" class="address-empty" :description="t('noAddress')" />
            <SendMail v-else :key="selectedAddressId" v-model:address-id="selectedAddressId"
                :address-options="addressOptions" :address-loading="addressLoading"
                @address-scroll="handleAddressScroll" @sent="emit('sent')" />
        </template>
        <template v-else>
            <n-input-group>
                <n-select v-model:value="addressFilter" :options="addressFilterOptions" clearable
                    :loading="addressLoading" :placeholder="mailboxT('addressQueryTip')"
                    @scroll="handleAddressScroll" />
                <n-button @click="querySendbox" type="primary" tertiary>
                    {{ mailboxT('query') }}
                </n-button>
            </n-input-group>
            <div class="filter-spacing"></div>
            <SendBox :key="sendboxKey" :fetch-mail-data="fetchSendbox" show-e-mail-from
                :enable-user-delete-email="openSettings.enableUserDeleteEmail"
                :delete-mail="deleteSendboxMail" />
        </template>
    </div>
</template>

<style scoped>
.user-send-box {
    padding-top: 10px;
    text-align: left;
}

.filter-spacing {
    margin-top: 10px;
}

.address-empty {
    padding: 72px 0;
}

</style>
