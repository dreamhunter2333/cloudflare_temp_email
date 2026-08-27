<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import AddressCredentialModal from '../../components/AddressCredentialModal.vue'

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
    if (!emailName.value || !emailDomain.value) {
        message.error(t('fillInAllFields'))
        return
    }
    try {
        const domain = subdomainMode.value === "custom"
            ? `${customSubdomain.value.trim()}.${emailDomain.value}`
            : emailDomain.value
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
        <n-card :bordered="false" embedded style="max-width: 600px;">
            <n-form-item-row v-if="openSettings.prefix" :label="t('enablePrefix')">
                <n-switch v-model:value="enablePrefix" :round="false" />
            </n-form-item-row>
            <n-form-item-row :label="t('address')">
                <n-spin :show="generateNameLoading" style="width: 100%;">
                    <div>
                        <n-button @click="generateName" style="margin-bottom: 10px;">
                            {{ t('generateName') }}
                        </n-button>
                        <n-input-group>
                            <n-input-group-label v-if="enablePrefix && openSettings.prefix">
                                {{ openSettings.prefix }}
                            </n-input-group-label>
                            <n-input v-model:value="emailName" />
                            <n-input-group-label>@</n-input-group-label>
                            <n-select v-model:value="emailDomain" :consistent-menu-width="false"
                                :options="openSettings.domains" />
                        </n-input-group>
                    </div>
                </n-spin>
            </n-form-item-row>
            <n-form-item-row v-if="canUseRandomSubdomain">
                <div style="width: 100%;">
                    <n-radio-group v-model:value="subdomainMode">
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
                        <n-input v-model:value="customSubdomain" />
                        <n-input-group-label>.{{ emailDomain }}</n-input-group-label>
                    </n-input-group>
                </div>
            </n-form-item-row>
            <n-button @click="newEmail" type="primary" block :loading="loading"
                :disabled="subdomainMode === 'custom' && !customSubdomain.trim()">
                {{ t('creatNewEmail') }}
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
