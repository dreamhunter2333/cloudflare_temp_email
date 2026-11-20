<script setup>
import { ref, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { getLocaleOptions } from '@/i18n/locale-registry'
import { useGlobalState } from '../../store'
import { customProtocols, normalizeModelBaseUrl } from './customMailModel'
import { useMailboxAiSettings } from './useMailboxAiSettings'

const { t } = useScopedI18n('views.index.AccountSettings')
const { settings, mailTranslationLanguage } = useGlobalState()
const { address, profile, apiKey, saveCustomModel, clearCustomModel } = useMailboxAiSettings()
const draft = ref({})
const invalidUrl = ref(false)
const status = ref('')
const languageOptions = getLocaleOptions()

watch([address, profile, apiKey], () => {
    draft.value = {
        protocol: profile.value?.protocol || 'openai-chat',
        baseUrl: profile.value?.baseUrl || '',
        model: profile.value?.model || '',
        summaryPrompt: profile.value?.summaryPrompt || '',
        apiKey: apiKey.value,
    }
    invalidUrl.value = false
}, { immediate: true })

watch(address, () => { status.value = '' })

function changeConnection(field, value) {
    if (value !== draft.value[field]) draft.value.apiKey = ''
    draft.value[field] = value
    invalidUrl.value = false
    status.value = ''
}

function save(event) {
    const { protocol, baseUrl, model, summaryPrompt, apiKey: key } = draft.value
    const url = normalizeModelBaseUrl(baseUrl)
    if (!url) {
        invalidUrl.value = true
        event.currentTarget.elements.namedItem('baseUrl')?.focus()
        return
    }
    if (!model.trim() || !key.trim()) return
    saveCustomModel({ protocol, baseUrl: url, model: model.trim(), summaryPrompt: summaryPrompt.trim() }, key.trim())
    status.value = 'customAiSaved'
}

function clear() {
    clearCustomModel()
    status.value = 'customAiCleared'
}
</script>

<template>
    <n-card embedded>
        <details>
            <summary class="mail-ai-settings-heading"><n-text strong>{{ t('mailAiAssistant') }}</n-text></summary>
            <n-form-item class="mail-ai-language" :label="t('translationLanguage')" label-placement="left" label-align="left" :show-feedback="false"
                :label-props="{ for: 'mail-translation-language' }">
                <n-select v-model:value="mailTranslationLanguage" filterable class="translation-language-select"
                    :input-props="{ id: 'mail-translation-language' }"
                    :options="[{ label: t('followInterfaceLanguage'), value: '' }, ...languageOptions]" />
            </n-form-item>

            <template v-if="settings.mailAiProcessing === 'custom'">
                <n-divider />
                <form class="custom-ai-form" :aria-label="t('customAiModel')" method="post" @submit.prevent="save" @input="status = ''">
                    <n-text depth="3">{{ t('customAiNotice') }}</n-text>
                    <n-form-item :label="t('customAiProtocol')" :show-feedback="false">
                        <n-radio-group name="protocol" :aria-label="t('customAiProtocol')" :value="draft.protocol"
                            @update:value="changeConnection('protocol', $event)">
                            <n-space :size="[16, 6]">
                                <n-radio v-for="option in customProtocols" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </n-radio>
                            </n-space>
                        </n-radio-group>
                    </n-form-item>
                    <n-form-item label="API Base URL" :label-props="{ for: 'mail-ai-url' }"
                        :show-feedback="invalidUrl" :validation-status="invalidUrl ? 'error' : undefined">
                        <n-input :value="draft.baseUrl" placeholder="https://ai.example.com/v1"
                            :input-props="{ id: 'mail-ai-url', name: 'baseUrl', required: true, inputmode: 'url', spellcheck: false,
                                'aria-invalid': invalidUrl, 'aria-describedby': invalidUrl ? 'mail-ai-url-error' : undefined }"
                            @update:value="changeConnection('baseUrl', $event)" />
                        <template #feedback>
                            <span v-if="invalidUrl" id="mail-ai-url-error">{{ t('customAiInvalidUrl') }}</span>
                        </template>
                    </n-form-item>
                    <n-form-item :label="t('customAiModelName')" :label-props="{ for: 'mail-ai-model' }" :show-feedback="false">
                        <n-input v-model:value="draft.model" placeholder="" maxlength="240"
                            :input-props="{ id: 'mail-ai-model', name: 'model', required: true, pattern: '.*\\S.*', spellcheck: false }" />
                    </n-form-item>
                    <n-form-item label="API Key" :label-props="{ for: 'mail-ai-key' }">
                        <n-input v-model:value="draft.apiKey" placeholder="" type="password" show-password-on="click"
                            :input-props="{ id: 'mail-ai-key', name: 'apiKey', required: true, pattern: '.*\\S.*',
                                autocomplete: 'off', 'aria-describedby': 'mail-ai-key-help' }" />
                        <template #feedback><span id="mail-ai-key-help">{{ t('customAiKeyHelp') }}</span></template>
                    </n-form-item>
                    <n-form-item :label="t('customAiSummaryPrompt')" :label-props="{ for: 'mail-ai-summary-prompt' }" :show-feedback="false">
                        <n-input v-model:value="draft.summaryPrompt" type="textarea" :rows="2" maxlength="2000"
                            :placeholder="t('customAiPromptPlaceholder')"
                            :input-props="{ id: 'mail-ai-summary-prompt', name: 'summaryPrompt' }" />
                    </n-form-item>
                    <n-space align="center">
                        <n-button type="primary" attr-type="submit">{{ t('customAiSave') }}</n-button>
                        <n-button v-if="profile" attr-type="button" quaternary @click="clear">{{ t('customAiClear') }}</n-button>
                        <n-text role="status" depth="3">{{ status ? t(status) : '' }}</n-text>
                    </n-space>
                </form>
            </template>
        </details>
    </n-card>
</template>

<style scoped>
.mail-ai-settings-heading {
    cursor: pointer;
}

.mail-ai-language {
    margin-block-start: 12px;
}

.translation-language-select {
    min-width: 0;
    max-width: 220px;
    margin-inline-start: auto;
}

.custom-ai-form {
    display: grid;
    gap: 12px;
}
</style>
