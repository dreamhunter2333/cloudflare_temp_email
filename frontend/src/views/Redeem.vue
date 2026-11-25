<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
    AlternateEmailOutlined,
    ArrowBackOutlined,
    CheckCircleOutlined,
    RedeemOutlined,
    SendOutlined,
} from '@vicons/material'

import { api } from '../api'
import AddressCredentialContent from '../components/AddressCredentialContent.vue'
import { useGlobalState } from '../store'
import { useScopedI18n } from '../i18n/app'
import { getRouterPathWithLang } from '../utils'

const router = useRouter()
const message = useMessage()
const notification = useNotification()
const { locale, t } = useScopedI18n('views.Redeem')
const {
    jwt,
    settings,
    openSettings,
    userSettings,
    addressPassword,
    showAddressCredential,
} = useGlobalState()

const code = ref('')
const codeInfo = ref(null)
const redeemStarted = ref(false)
const completed = ref(null)
const targetUserEmail = ref('')
const targetAddress = ref(settings.value.address || '')
const emailName = ref('')
const emailDomain = ref('')
const subdomainMode = ref('normal')
const customSubdomain = ref('')
let latestQueryRequest = 0

const activeRedeemType = computed(() => completed.value?.type || codeInfo.value?.redeem_type || '')
const codeStatusType = computed(() => {
    if (codeInfo.value?.status === 'expired') return 'error'
    return codeInfo.value?.status === 'unused' ? 'success' : 'default'
})
const redeemTypes = computed(() => [
    {
        type: 'role',
        icon: RedeemOutlined,
        title: t('roleTitle'),
    },
    {
        type: 'send_balance',
        icon: SendOutlined,
        title: t('balanceTitle'),
    },
    {
        type: 'address_prefix_once',
        icon: AlternateEmailOutlined,
        title: t('prefixTitle'),
    },
])
const redeemCodeUrl = computed(() => {
    try {
        const url = new URL(openSettings.value.redeemCodeUrl)
        return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
    } catch {
        return ''
    }
})

const domainsOptions = computed(() => {
    const allowed = openSettings.value.defaultDomains?.length
        ? openSettings.value.defaultDomains
        : openSettings.value.domains.map((item) => item.value)
    return openSettings.value.domains.filter((item) => allowed.includes(item.value))
})

const canUseRandomSubdomain = computed(() => (
    openSettings.value.randomSubdomainDomains?.includes(emailDomain.value)
))
const addressNameMaxLength = computed(() => Math.max(
    (openSettings.value.maxAddressLen || 30) - (codeInfo.value?.value?.length || 0),
    1,
))
const addressNameMinLength = computed(() => Math.min(
    addressNameMaxLength.value,
    Math.max(
        (openSettings.value.minAddressLen || 1) - (codeInfo.value?.value?.length || 0),
        1,
    ),
))

watch(canUseRandomSubdomain, (enabled) => {
    if (!enabled) subdomainMode.value = 'normal'
})

watch(addressNameMaxLength, (maxLength) => {
    emailName.value = emailName.value.slice(0, maxLength)
})

watch(domainsOptions, (options) => {
    if (!options.some((item) => item.value === emailDomain.value)) {
        emailDomain.value = options[0]?.value || ''
    }
}, { immediate: true })

watch(code, () => {
    latestQueryRequest += 1
    codeInfo.value = null
    redeemStarted.value = false
})

watch(() => userSettings.value.user_email, (email) => {
    if (!targetUserEmail.value) targetUserEmail.value = email || ''
}, { immediate: true })

watch(() => settings.value.address, (address) => {
    if (!targetAddress.value) targetAddress.value = address || ''
}, { immediate: true })

const loadContext = async () => {
    if (!openSettings.value.fetched) {
        await api.getOpenSettings(message, notification)
    }
    if (!openSettings.value.enableRedeemCode) {
        await router.replace(getRouterPathWithLang('/', locale.value))
        return
    }
    if (jwt.value && !settings.value.address) {
        try {
            await api.getSettings()
        } catch (error) {
            console.error(error)
        }
    }
}

const queryCode = async () => {
    const queriedCode = code.value.trim()
    if (!queriedCode) return
    const requestId = ++latestQueryRequest
    try {
        const result = await api.fetch('/redeem_api/query', {
            method: 'POST',
            body: JSON.stringify({ code: queriedCode }),
        })
        if (requestId !== latestQueryRequest || code.value.trim() !== queriedCode) return
        codeInfo.value = result
        redeemStarted.value = false
        completed.value = null
        await loadContext()
    } catch (error) {
        if (requestId !== latestQueryRequest) return
        codeInfo.value = null
        message.error(error.message || 'error')
    }
}

const resetRedemption = () => {
    code.value = ''
    codeInfo.value = null
    redeemStarted.value = false
    completed.value = null
}

const redeem = async () => {
    if (!codeInfo.value) return
    try {
        let result
        if (codeInfo.value.redeem_type === 'role') {
            if (!targetUserEmail.value.trim()) return
            result = await api.fetch('/redeem_api/redeem', {
                method: 'POST',
                body: JSON.stringify({
                    code: code.value,
                    user_email: targetUserEmail.value.trim(),
                }),
            })
        } else if (codeInfo.value.redeem_type === 'send_balance') {
            if (!targetAddress.value.trim()) return
            result = await api.fetch('/redeem_api/redeem', {
                method: 'POST',
                body: JSON.stringify({
                    code: code.value,
                    address: targetAddress.value.trim(),
                }),
            })
        }
        completed.value = result
        codeInfo.value = null
        if (result?.type === 'role'
            && result.user_email.toLowerCase() === userSettings.value.user_email?.trim().toLowerCase()
        ) {
            await api.getUserSettings(message)
        }
    } catch (error) {
        message.error(error.message || 'error')
    }
}

const generateName = () => {
    const length = Math.min(
        addressNameMaxLength.value,
        Math.max(addressNameMinLength.value, 8),
    )
    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    emailName.value = Array.from(bytes, (value) => charset[value % charset.length]).join('')
}

const createAddress = async () => {
    if (!codeInfo.value || codeInfo.value.redeem_type !== 'address_prefix_once') return
    try {
        const domain = subdomainMode.value === 'custom'
            ? `${customSubdomain.value.trim()}.${emailDomain.value}`
            : emailDomain.value
        const result = await api.fetch('/redeem_api/redeem', {
            method: 'POST',
            body: JSON.stringify({
                code: code.value,
                name: openSettings.value.disableCustomAddressName ? '' : emailName.value,
                domain,
                enableRandomSubdomain: subdomainMode.value === 'random',
            }),
        })
        completed.value = result
        codeInfo.value = null
    } catch (error) {
        message.error(error.message || 'error')
    }
}

const showRedeemResult = async () => {
    try {
        completed.value = await api.fetch('/redeem_api/result', {
            method: 'POST',
            body: JSON.stringify({ code: code.value }),
        })
        codeInfo.value = null
    } catch (error) {
        message.error(error.message || 'error')
    }
}

const useRedeemedAddress = async () => {
    if (completed.value?.type !== 'address_prefix_once') return
    jwt.value = completed.value.jwt
    addressPassword.value = completed.value.password || ''
    await api.getSettings()
    showAddressCredential.value = true
    await router.push(getRouterPathWithLang('/', locale.value))
}

const goBack = async () => {
    await router.push(getRouterPathWithLang('/', locale.value))
}

onMounted(loadContext)
</script>

<template>
    <main v-if="openSettings.enableRedeemCode" class="redeem-page">
        <section class="redeem-shell">
            <n-card class="redeem-card" :bordered="false" embedded>
                <n-button text class="back-link" @click="goBack">
                    <template #icon>
                        <n-icon :component="ArrowBackOutlined" />
                    </template>
                    {{ t('back') }}
                </n-button>
                <div class="heading-copy">
                    <div class="heading-icon">
                        <n-icon :component="RedeemOutlined" />
                    </div>
                    <div>
                        <h1>{{ t('title') }}</h1>
                    </div>
                </div>

                <div class="type-section">
                    <div class="section-label">{{ t('categoryTitle') }}</div>
                    <div class="type-grid">
                        <div v-for="item in redeemTypes" :key="item.type" class="type-card"
                            :class="{ active: activeRedeemType === item.type }">
                            <n-icon :component="item.icon" />
                            <span>{{ item.title }}</span>
                        </div>
                    </div>
                </div>

                <n-divider />
                <div v-if="completed" class="success-state">
                    <n-icon :component="CheckCircleOutlined" />
                    <h2>{{ t('success') }}</h2>
                    <p v-if="completed.type === 'role'">
                        {{ t('roleSuccess', { role: completed.role, email: completed.user_email }) }}
                    </p>
                    <p v-else-if="completed.type === 'send_balance'">
                        {{ t('balanceSuccess', { amount: completed.amount, address: completed.address }) }}
                    </p>
                    <template v-else>
                        <p>{{ t('addressSuccess') }}</p>
                        <AddressCredentialContent class="credential-result" :address="completed.address"
                            :jwt="completed.jwt" :address-password="completed.password" />
                        <n-button type="primary" block @click="useRedeemedAddress">
                            {{ t('openAddress') }}
                        </n-button>
                    </template>
                    <n-button type="primary" secondary @click="resetRedemption">
                        {{ t('redeemAnother') }}
                    </n-button>
                </div>

                <div v-else class="redeem-form">
                    <n-form-item :label="t('codeLabel')" :show-feedback="false">
                        <n-input data-testid="redeem-code-input" v-model:value="code" size="large" :placeholder="t('codePlaceholder')"
                            @keyup.enter="queryCode" />
                    </n-form-item>
                    <n-button v-if="!codeInfo" type="primary" size="large" block :disabled="!code.trim()"
                        @click="queryCode">
                        {{ t('checkCode') }}
                    </n-button>
                    <n-button v-if="redeemCodeUrl" data-testid="redeem-code-link" class="get-code-link"
                        text tag="a" target="_blank" rel="noopener noreferrer" :href="redeemCodeUrl">
                        {{ t('getCode') }}
                    </n-button>

                    <div v-if="codeInfo" class="redemption-detail">
                        <n-divider />

                        <template v-if="codeInfo.redeem_type === 'role'">
                            <div class="detail-heading">
                                <n-icon :component="RedeemOutlined" />
                                <div>
                                    <h2>{{ t('roleTitle') }}</h2>
                                    <p>{{ t('roleDescription', { role: codeInfo.value }) }}</p>
                                </div>
                                <n-tag :type="codeStatusType" :bordered="false">
                                    {{ t(codeInfo.status) }}
                                </n-tag>
                            </div>
                            <n-button v-if="codeInfo.status === 'unused' && !redeemStarted" data-testid="redeem-now" type="primary" block
                                @click="redeemStarted = true">
                                {{ t('redeemNow') }}
                            </n-button>
                            <template v-else-if="codeInfo.status === 'unused'">
                                <n-form-item :label="t('userEmail')">
                                    <n-input data-testid="redeem-user-email" v-model:value="targetUserEmail"
                                        :placeholder="t('userEmailPlaceholder')" />
                                </n-form-item>
                                <n-button type="primary" block :disabled="!targetUserEmail.trim()" @click="redeem">
                                    {{ t('confirmRole') }}
                                </n-button>
                            </template>
                            <n-button v-else-if="codeInfo.status === 'redeemed'" data-testid="redeem-result"
                                type="primary" block @click="showRedeemResult">
                                {{ t('viewResult') }}
                            </n-button>
                        </template>

                        <template v-else-if="codeInfo.redeem_type === 'send_balance'">
                            <div class="detail-heading">
                                <n-icon :component="SendOutlined" />
                                <div>
                                    <h2>{{ t('balanceTitle') }}</h2>
                                    <p>{{ t('balanceDescription', { amount: codeInfo.value }) }}</p>
                                </div>
                                <n-tag :type="codeStatusType" :bordered="false">
                                    {{ t(codeInfo.status) }}
                                </n-tag>
                            </div>
                            <n-button v-if="codeInfo.status === 'unused' && !redeemStarted" data-testid="redeem-now" type="primary" block
                                @click="redeemStarted = true">
                                {{ t('redeemNow') }}
                            </n-button>
                            <template v-else-if="codeInfo.status === 'unused'">
                                <n-form-item :label="t('targetAddress')">
                                    <n-input data-testid="redeem-target-address" v-model:value="targetAddress"
                                        :placeholder="t('targetAddress')" />
                                </n-form-item>
                                <n-button type="primary" block :disabled="!targetAddress.trim()" @click="redeem">
                                    {{ t('confirmBalance') }}
                                </n-button>
                            </template>
                            <n-button v-else-if="codeInfo.status === 'redeemed'" data-testid="redeem-result"
                                type="primary" block @click="showRedeemResult">
                                {{ t('viewResult') }}
                            </n-button>
                        </template>

                        <template v-else>
                            <div class="detail-heading">
                                <n-icon :component="AlternateEmailOutlined" />
                                <div>
                                    <h2>{{ t('prefixTitle') }}</h2>
                                    <p>{{ codeInfo.value
                                        ? t('prefixDescription', { prefix: codeInfo.value })
                                        : t('noPrefixDescription') }}</p>
                                </div>
                                <n-tag :type="codeStatusType" :bordered="false">
                                    {{ t(codeInfo.status) }}
                                </n-tag>
                            </div>
                            <n-button v-if="codeInfo.status === 'redeemed'" data-testid="redeem-result" type="primary" block
                                @click="showRedeemResult">
                                {{ t('viewResult') }}
                            </n-button>
                            <n-form v-else-if="codeInfo.status === 'unused'">
                                <n-form-item :label="t('address')">
                                    <n-input-group>
                                        <n-input-group-label v-if="codeInfo.value">{{ codeInfo.value }}</n-input-group-label>
                                        <n-input v-if="!openSettings.disableCustomAddressName" data-testid="redeem-address-name"
                                            v-model:value="emailName"
                                            :minlength="addressNameMinLength" :maxlength="addressNameMaxLength" />
                                        <n-input v-else :value="t('autoName')" disabled />
                                        <n-input-group-label>@</n-input-group-label>
                                        <n-select v-model:value="emailDomain" :options="domainsOptions"
                                            :consistent-menu-width="false" />
                                    </n-input-group>
                                </n-form-item>
                                <n-button v-if="!openSettings.disableCustomAddressName" size="small" @click="generateName">
                                    {{ t('randomName') }}
                                </n-button>
                                <n-form-item v-if="canUseRandomSubdomain" class="subdomain-options">
                                    <n-radio-group v-model:value="subdomainMode">
                                        <n-space vertical>
                                            <n-radio value="normal">{{ t('normalDomain') }}</n-radio>
                                            <n-radio value="random">{{ t('randomSubdomain') }}</n-radio>
                                            <n-radio value="custom">{{ t('customSubdomain') }}</n-radio>
                                        </n-space>
                                    </n-radio-group>
                                    <n-input-group v-if="subdomainMode === 'custom'">
                                        <n-input v-model:value="customSubdomain" />
                                        <n-input-group-label>.{{ emailDomain }}</n-input-group-label>
                                    </n-input-group>
                                </n-form-item>
                                <n-button type="primary" block
                                    :disabled="!emailDomain || (subdomainMode === 'custom' && !customSubdomain.trim())"
                                    @click="createAddress">
                                    {{ t('createAddress') }}
                                </n-button>
                            </n-form>
                        </template>
                    </div>
                </div>
            </n-card>
        </section>
    </main>
</template>

<style scoped>
.redeem-page {
    min-height: 70vh;
    padding: 24px 18px 56px;
}

.redeem-shell {
    width: min(720px, 100%);
    margin: 0 auto;
    text-align: left;
}

.back-link {
    margin-bottom: 12px;
}

.redeem-card {
    border-radius: 10px;
}

.heading-copy {
    display: flex;
    align-items: center;
    gap: 12px;
}

.heading-icon {
    display: grid;
    flex: 0 0 auto;
    width: 42px;
    height: 42px;
    place-items: center;
    color: #18a058;
    font-size: 24px;
    background: rgba(24, 160, 88, 0.12);
    border-radius: 8px;
}

.heading-copy h1 {
    margin: 0;
    font-size: 24px;
    line-height: 1.3;
}

.type-section {
    margin-top: 22px;
}

.section-label {
    margin-bottom: 10px;
    font-weight: 600;
}

.type-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.type-card {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 12px;
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 8px;
}

.type-card .n-icon {
    flex: 0 0 auto;
    color: #18a058;
    font-size: 20px;
}

.type-card span {
    min-width: 0;
}

.type-card.active {
    color: #18a058;
    border-color: rgba(24, 160, 88, 0.55);
    background: rgba(24, 160, 88, 0.08);
}

.redeem-card > :deep(.n-card__content) > .n-divider {
    margin: 22px 0;
}

.redeem-form > :deep(.n-form-item) {
    margin-bottom: 14px;
}

.redeem-form > .n-button {
    margin-top: 2px;
}

.redeem-form > .get-code-link {
    width: max-content;
    margin: 12px auto 0;
}

.redemption-detail :deep(.n-button),
.success-state > .n-button {
    margin-top: 14px;
}

.detail-heading {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 18px;
}

.detail-heading > .n-icon {
    flex: 0 0 auto;
    color: #18a058;
    font-size: 28px;
}

.detail-heading > .n-tag {
    flex: 0 0 auto;
    margin-left: auto;
}

.detail-heading p,
.success-state p {
    margin: 0;
    opacity: 0.68;
}

.detail-heading h2,
.success-state h2 {
    margin: 0 0 4px;
    font-size: 20px;
}

.subdomain-options :deep(.n-form-item-blank) {
    display: grid;
    gap: 12px;
}

.success-state {
    padding: 24px 8px;
    text-align: center;
}

.success-state > .n-icon {
    color: #18a058;
    font-size: 50px;
}

.credential-result {
    margin-top: 18px;
}

@media (max-width: 640px) {
    .redeem-page {
        padding: 16px 12px 48px;
    }

    .heading-copy h1 {
        font-size: 21px;
    }

    .type-card {
        flex-direction: column;
        justify-content: center;
        gap: 5px;
        padding: 10px 5px;
        text-align: center;
    }
}
</style>
