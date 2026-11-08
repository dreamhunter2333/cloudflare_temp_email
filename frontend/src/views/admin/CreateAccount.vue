<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import AddressCredentialModal from '../../components/AddressCredentialModal.vue'
import BatchExportModal from './BatchExportModal.vue'

const {
    loading, openSettings,
} = useGlobalState()
const message = useMessage()

const { t } = useScopedI18n('views.admin.CreateAccount')

const enablePrefix = ref(true)
const subdomainMode = ref("normal")
const customSubdomain = ref("")
const emailName = ref("")
const emailDomain = ref("")
const showReultModal = ref(false)
const result = ref("")
const addressPassword = ref("")
const createdAddress = ref("")

const busy = ref(false)
const batchCount = ref(10)
const batchRows = ref([])
const batchCompleted = ref(0)
const batchRequested = ref(0)
const batchError = ref("")
const showExportModal = ref(false)
let unmounted = false
onBeforeUnmount(() => { unmounted = true })

const invalidDomain = computed(() => !emailDomain.value
    || (subdomainMode.value === "custom" && !customSubdomain.value.trim()))
const validBatchCount = computed(() => Number.isInteger(batchCount.value)
    && batchCount.value >= 1 && batchCount.value <= 100)
const resolvedDomain = computed(() => subdomainMode.value === "custom"
    ? `${customSubdomain.value.trim()}.${emailDomain.value}`
    : emailDomain.value)

const createBatch = async () => {
    if (busy.value || generateNameLoading.value) return
    if (!validBatchCount.value || invalidDomain.value) {
        message.error(t('batchValidation'))
        return
    }
    const count = batchCount.value
    const options = {
        enablePrefix: enablePrefix.value,
        enableRandomSubdomain: subdomainMode.value === "random",
        domain: resolvedDomain.value,
    }
    const normalization = addressRegex.value
    batchCompleted.value = 0
    batchRequested.value = count
    batchError.value = ""
    busy.value = true
    try {
        for (let i = 0; i < count && !unmounted; i++) {
            const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
            const name = Array.from(crypto.getRandomValues(new Uint8Array(30)),
                byte => alphabet[byte % alphabet.length]).join('')
                .replace(normalization, '').slice(0, 30)
            if (!name || !/^[a-z0-9]{1,30}$/.test(name)) {
                throw new Error(t('batchNameError'))
            }
            const res = await api.fetch('/admin/new_address', {
                method: 'POST',
                body: JSON.stringify({ ...options, name }),
                showLoading: false,
            })
            if (unmounted) break
            batchRows.value.push({ address: res.address, jwt: res.jwt })
            batchCompleted.value++
        }
    } catch (error) {
        if (!unmounted) batchError.value = error.message || "error"
    } finally {
        busy.value = false
    }
}

const clearBatch = () => {
    if (busy.value) return
    batchRows.value = []
    batchCompleted.value = 0
    batchRequested.value = 0
    batchError.value = ""
}

const addressRegex = computed(() => {
    try {
        if (openSettings.value.addressRegex) {
            return new RegExp(openSettings.value.addressRegex, 'g');
        }
    } catch (error) {
        console.error(error);
        message.error(`Invalid addressRegex: ${openSettings.value.addressRegex}`);
    }
    return /[^a-z0-9]/g;
});

const generateNameLoading = ref(false);
const generateName = async () => {
    try {
        generateNameLoading.value = true;
        const { faker } = await import('https://esm.sh/@faker-js/faker');
        emailName.value = faker.internet.email()
            .split('@')[0]
            .replace(/\s+/g, '.')
            .replace(/\.{2,}/g, '.')
            .replace(addressRegex.value, '')
            .toLowerCase();
        // support maxAddressLen
        if (emailName.value.length > openSettings.value.maxAddressLen) {
            emailName.value = emailName.value.slice(0, openSettings.value.maxAddressLen);
        }
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        generateNameLoading.value = false;
    }
};

const canUseRandomSubdomain = computed(() => {
    if (!emailDomain.value) {
        return false
    }
    return (openSettings.value.randomSubdomainDomains || []).includes(emailDomain.value)
})

watch(canUseRandomSubdomain, (enabled) => {
    if (!enabled) {
        subdomainMode.value = "normal"
    }
})

const newEmail = async () => {
    if (busy.value || generateNameLoading.value) return
    if (!emailName.value || invalidDomain.value) {
        message.error(t('fillInAllFields'))
        return
    }
    busy.value = true
    try {
        const domain = resolvedDomain.value
        const res = await api.fetch(`/admin/new_address`, {
            method: 'POST',
            body: JSON.stringify({
                enablePrefix: enablePrefix.value,
                enableRandomSubdomain: subdomainMode.value === "random",
                name: emailName.value,
                domain,
            })
        })
        result.value = res["jwt"];
        addressPassword.value = res["password"] || '';
        createdAddress.value = res["address"] || '';
        message.success(t('successTip'))
        showReultModal.value = true
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        busy.value = false
    }
}

onMounted(async () => {
    if (openSettings.prefix) {
        enablePrefix.value = true
    }
    emailDomain.value = openSettings.value.domains?.[0]?.value || ""
})
</script>

<template>
    <div class="center">
        <AddressCredentialModal v-model:show="showReultModal" :address="createdAddress" :jwt="result"
            :address-password="addressPassword" />
        <BatchExportModal v-model:show="showExportModal" :rows="batchRows" />
        <n-card :bordered="false" embedded style="max-width: 600px;">
            <n-form-item-row v-if="openSettings.prefix" :label="t('enablePrefix')">
                <n-switch :disabled="busy" v-model:value="enablePrefix" :round="false" />
            </n-form-item-row>
            <n-form-item-row :label="t('address')">
                <n-spin :show="generateNameLoading" style="width: 100%;">
                    <div>
                        <n-button :disabled="busy" @click="generateName" style="margin-bottom: 10px;">
                            {{ t('generateName') }}
                        </n-button>
                        <n-input-group>
                            <n-input-group-label v-if="enablePrefix && openSettings.prefix">
                                {{ openSettings.prefix }}
                            </n-input-group-label>
                            <n-input :disabled="busy" v-model:value="emailName" />
                            <n-input-group-label>@</n-input-group-label>
                            <n-select :disabled="busy" v-model:value="emailDomain" :consistent-menu-width="false"
                                :options="openSettings.domains" />
                        </n-input-group>
                    </div>
                </n-spin>
            </n-form-item-row>
            <n-form-item-row v-if="canUseRandomSubdomain">
                <div style="width: 100%;">
                    <n-radio-group :disabled="busy" v-model:value="subdomainMode">
                        <n-space vertical>
                            <n-radio value="normal">{{ t('normalSubdomain') }}</n-radio>
                            <n-radio value="random">{{ t('enableRandomSubdomain') }}</n-radio>
                            <n-radio value="custom">{{ t('enableCustomSubdomain') }}</n-radio>
                        </n-space>
                    </n-radio-group>
                    <p v-if="subdomainMode === 'random'" style="margin: 8px 0 0; opacity: 0.75;">
                        {{ t('randomSubdomainTip') }}
                    </p>
                    <n-input-group v-if="subdomainMode === 'custom'" style="margin-top: 8px;">
                        <n-input :disabled="busy" v-model:value="customSubdomain" />
                        <n-input-group-label>.{{ emailDomain }}</n-input-group-label>
                    </n-input-group>
                </div>
            </n-form-item-row>
            <n-button @click="newEmail" type="primary" block :loading="loading"
                :disabled="busy || generateNameLoading || invalidDomain">
                {{ t('createEmailAddress') }}
            </n-button>
            <n-divider>{{ t('batchTitle') }}</n-divider>
            <n-form-item-row :label="t('batchCount')">
                <n-input-number v-model:value="batchCount" :disabled="busy" :show-button="false"
                    :input-props="{ 'aria-label': t('batchCount') }" style="width: 100%;" />
            </n-form-item-row>
            <n-button @click="createBatch" type="primary" block
                :disabled="busy || generateNameLoading || invalidDomain || !validBatchCount">
                {{ t('createBatch') }}
            </n-button>
            <p>{{ t('batchProgress', { completed: batchCompleted, requested: batchRequested }) }}</p>
            <n-alert v-if="batchError" type="error" style="margin-bottom: 12px;">
                {{ t('batchStopped') }} {{ batchError }}
            </n-alert>
            <n-space>
                <n-button @click="showExportModal = true" :disabled="busy || !batchRows.length">{{ t('exportCsv') }}</n-button>
                <n-button @click="clearBatch" :disabled="busy || !batchRows.length">{{ t('clearResults') }}</n-button>
            </n-space>
            <p>{{ t('batchTotal', { count: batchRows.length }) }}</p>
            <p>{{ t('batchSecurity') }}</p>
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
