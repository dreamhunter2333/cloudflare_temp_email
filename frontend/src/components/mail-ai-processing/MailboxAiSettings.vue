<script setup>
import { useScopedI18n } from '@/i18n/app'
import { getLocaleOptions } from '@/i18n/locale-registry'
import { useGlobalState } from '../../store'

const { t } = useScopedI18n('views.index.AccountSettings')
const { mailTranslationLanguage } = useGlobalState()
const languageOptions = getLocaleOptions()
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
</style>
