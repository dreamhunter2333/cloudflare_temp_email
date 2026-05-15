<script setup>
import { computed } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../store'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  address: {
    type: String,
    default: '',
  },
  jwt: {
    type: String,
    default: '',
  },
  addressPassword: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:show'])

const { openSettings, auth } = useGlobalState()
const { locale, t } = useScopedI18n('components.AddressCredentialModal')
const message = useMessage()

const modalShow = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE || ''
const frontendBaseUrl = computed(() => window.location.origin)
const apiBaseUrl = computed(() => (configuredApiBaseUrl || frontendBaseUrl.value).replace(/\/$/, ''))
const docLocale = computed(() => locale.value === 'zh' ? 'zh' : 'en')
const agentDocUrl = computed(() => `https://temp-mail-docs.awsl.uk/${docLocale.value}/guide/feature/agent-email.html`)
const smtpImapDocUrl = computed(() => `https://temp-mail-docs.awsl.uk/${docLocale.value}/guide/feature/config-smtp-proxy.html`)
const agentSkillUrl = 'https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/skills/cf-temp-mail-agent-mail/SKILL.md'
const autoLoginUrl = computed(() => `${frontendBaseUrl.value}/?jwt=${encodeURIComponent(props.jwt)}`)
const showAgent = computed(() => !!openSettings.value.enableAgentEmailInfo)
const smtpImapConfig = computed(() => openSettings.value.smtpImapProxyConfig || {})
const smtpConfig = computed(() => smtpImapConfig.value.smtp || {})
const imapConfig = computed(() => smtpImapConfig.value.imap || {})
const showSmtpImap = computed(() => !!smtpConfig.value.host || !!imapConfig.value.host)
const securityLabel = computed(() =>
  smtpConfig.value.starttls || imapConfig.value.starttls ? t('starttls') : t('plainOrProxyTls')
)
const agentConfigJson = computed(() => JSON.stringify({
  base: apiBaseUrl.value,
  jwt: props.jwt,
  site_password: auth.value || '',
}, null, 2))
const agentText = computed(() => [
  `${t('currentAddress')}: ${props.address || '-'}`,
  `${t('apiBase')}: ${apiBaseUrl.value}`,
  `${t('agentSkill')}: ${agentSkillUrl}`,
  `${t('agentConfig')}:`,
  agentConfigJson.value,
].join('\n'))
const smtpImapText = computed(() => [
  `${t('smtpHost')}: ${smtpConfig.value.host || '-'}`,
  `${t('smtpPort')}: ${smtpConfig.value.port || 8025}`,
  `${t('imapHost')}: ${imapConfig.value.host || '-'}`,
  `${t('imapPort')}: ${imapConfig.value.port || 11143}`,
  `${t('security')}: ${securityLabel.value}`,
  `${t('username')}: ${props.address || '-'}`,
  `${t('password')}: ${props.jwt}`,
].join('\n'))

const copyText = async (text) => {
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      message.success(t('copySuccess'))
      return
    }

    const textarea = document.createElement('textarea')
    try {
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      if (document.execCommand('copy')) {
        message.success(t('copySuccess'))
        return
      }
      message.error(t('copyFailed'))
    } finally {
      textarea.parentNode?.removeChild(textarea)
    }
  } catch (error) {
    console.error(error)
    message.error(t('copyFailed'))
  }
}

</script>

<template>
  <n-modal v-model:show="modalShow" preset="card" :title="t('title')"
    style="width: min(760px, calc(100vw - 32px));">
    <n-alert type="info" :show-icon="false" :bordered="false">
      {{ t('tip') }}
    </n-alert>
    <section class="credential-panel">
      <h3 class="credential-title">{{ t('addressCredential') }}</h3>
      <div class="credential-section">
        <div class="credential-field" v-if="address">
          <span class="credential-label">{{ t('currentAddress') }}</span>
          <div class="credential-copy-row">
            <code class="credential-code">{{ address }}</code>
            <n-button size="tiny" tertiary type="primary" @click="copyText(address)">
              {{ t('copySection') }}
            </n-button>
          </div>
        </div>
        <div class="credential-field">
          <span class="credential-label">{{ t('addressCredentialLabel') }}</span>
          <div class="credential-copy-row">
            <code class="credential-code">{{ jwt }}</code>
            <n-button size="tiny" tertiary type="primary" @click="copyText(jwt)">
              {{ t('copySection') }}
            </n-button>
          </div>
        </div>
        <div class="credential-field" v-if="addressPassword">
          <span class="credential-label">{{ t('addressPassword') }}</span>
          <code class="credential-code">{{ addressPassword }}</code>
        </div>
      </div>
    </section>

    <n-collapse accordion class="credential-collapse">
      <n-collapse-item v-if="showAgent" name="agent" :title="t('agentAccess')">
        <template #header-extra>
          <n-button size="tiny" tertiary type="primary" @click.stop="copyText(agentText)">
            {{ t('copySection') }}
          </n-button>
        </template>
        <div class="credential-section">
          <p class="credential-tip">{{ t('agentAccessTip') }}</p>
          <div class="credential-field">
            <span class="credential-label">{{ t('apiBase') }}</span>
            <code class="credential-code">{{ apiBaseUrl }}</code>
          </div>
          <div class="credential-field">
            <span class="credential-label">{{ t('agentSkill') }}</span>
            <code class="credential-code">
              <a :href="agentSkillUrl" target="_blank" rel="noopener noreferrer">{{ agentSkillUrl }}</a>
            </code>
          </div>
          <div class="credential-field">
            <span class="credential-label">{{ t('agentConfig') }}</span>
            <pre class="credential-code credential-code-block">{{ agentConfigJson }}</pre>
          </div>
          <div class="credential-actions">
            <n-button tag="a" :href="agentDocUrl" target="_blank" rel="noopener noreferrer" text type="primary">
              {{ t('docs') }}
            </n-button>
          </div>
        </div>
      </n-collapse-item>

      <n-collapse-item v-if="showSmtpImap" name="smtp-imap" :title="t('smtpImapAccess')">
        <template #header-extra>
          <n-button size="tiny" tertiary type="primary" @click.stop="copyText(smtpImapText)">
            {{ t('copySection') }}
          </n-button>
        </template>
        <div class="credential-section">
          <p class="credential-tip">{{ t('smtpImapTip') }}</p>
          <div class="credential-grid">
            <div class="credential-field">
              <span class="credential-label">{{ t('smtpHost') }}</span>
              <code class="credential-code">{{ smtpConfig.host || '-' }}</code>
            </div>
            <div class="credential-field">
              <span class="credential-label">{{ t('smtpPort') }}</span>
              <code class="credential-code">{{ smtpConfig.port || 8025 }}</code>
            </div>
            <div class="credential-field">
              <span class="credential-label">{{ t('imapHost') }}</span>
              <code class="credential-code">{{ imapConfig.host || '-' }}</code>
            </div>
            <div class="credential-field">
              <span class="credential-label">{{ t('imapPort') }}</span>
              <code class="credential-code">{{ imapConfig.port || 11143 }}</code>
            </div>
          </div>
          <div class="credential-field">
            <span class="credential-label">{{ t('security') }}</span>
            <code class="credential-code">{{ securityLabel }}</code>
          </div>
          <div class="credential-field">
            <span class="credential-label">{{ t('username') }}</span>
            <code class="credential-code">{{ address }}</code>
          </div>
          <div class="credential-field">
            <span class="credential-label">{{ t('password') }}</span>
            <code class="credential-code">{{ jwt }}</code>
          </div>
          <div class="credential-actions">
            <n-button tag="a" :href="smtpImapDocUrl" target="_blank" rel="noopener noreferrer" text type="primary">
              {{ t('docs') }}
            </n-button>
          </div>
        </div>
      </n-collapse-item>

      <n-collapse-item name="share-link" :title="t('autoLoginLink')">
        <template #header-extra>
          <n-button size="tiny" tertiary type="primary" @click.stop="copyText(autoLoginUrl)">
            {{ t('copySection') }}
          </n-button>
        </template>
        <div class="credential-section">
          <div class="credential-field">
            <code class="credential-code">{{ autoLoginUrl }}</code>
          </div>
        </div>
      </n-collapse-item>
    </n-collapse>
  </n-modal>
</template>

<style scoped>
.credential-collapse {
  margin-top: 14px;
}

.credential-panel {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.credential-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.credential-section {
  display: grid;
  gap: 12px;
  text-align: left;
}

.credential-tip {
  margin: 0;
  color: var(--n-text-color-2);
  line-height: 1.6;
}

.credential-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.credential-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.credential-label {
  color: var(--n-text-color-2);
  font-size: 12px;
  font-weight: 600;
}

.credential-code {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--n-color-embedded);
  font-size: 12px;
  line-height: 1.5;
}

.credential-copy-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
}

.credential-code-block {
  margin: 0;
  white-space: pre-wrap;
}

.credential-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .credential-grid {
    grid-template-columns: 1fr;
  }

  .credential-copy-row {
    grid-template-columns: 1fr;
  }
}
</style>
