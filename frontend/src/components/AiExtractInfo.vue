<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ContentCopyOutlined, LinkRound, CodeRound } from '@vicons/material';
import { useMessage } from 'naive-ui';
import { useGlobalState } from '../store';

const message = useMessage();
const { isDark } = useGlobalState();

// Dark mode: use Gmail's softer blue (#A8C7FA) for better readability
const alertThemeOverrides = computed(() => {
  if (isDark.value) {
    return {
      colorSuccess: 'rgba(168, 199, 250, 0.15)',
      borderSuccess: '1px solid rgba(168, 199, 250, 0.3)',
      iconColorSuccess: '#A8C7FA',
      titleTextColorSuccess: '#A8C7FA',
    }
  }
  return {}
});

const tagThemeOverrides = computed(() => {
  if (isDark.value) {
    return {
      colorSuccess: 'rgba(168, 199, 250, 0.15)',
      borderSuccess: '1px solid rgba(168, 199, 250, 0.3)',
      textColorSuccess: '#A8C7FA',
    }
  }
  return {}
});

const { t } = useI18n({
  messages: {
    en: {
      authCode: 'Verification Code',
      authLink: 'Authentication Link',
      serviceLink: 'Service Link',
      subscriptionLink: 'Subscription Link',
      otherLink: 'Other Link',
      copySuccess: 'Copied successfully',
      copyFailed: 'Copy failed',
      open: 'Open',
    },
    zh: {
      authCode: '验证码',
      authLink: '认证链接',
      serviceLink: '服务链接',
      subscriptionLink: '订阅链接',
      otherLink: '其他链接',
      copySuccess: '复制成功',
      copyFailed: '复制失败',
      open: '打开',
    }
  }
});

const props = defineProps({
  metadata: {
    type: String,
    default: null
  },
  compact: {
    type: Boolean,
    default: false
  }
});

const aiExtract = computed(() => {
  if (!props.metadata) return null;
  try {
    const data = JSON.parse(props.metadata);
    return data.ai_extract || null;
  } catch (e) {
    return null;
  }
});

const typeLabel = computed(() => {
  if (!aiExtract.value) return '';
  const typeMap = {
    auth_code: t('authCode'),
    auth_link: t('authLink'),
    service_link: t('serviceLink'),
    subscription_link: t('subscriptionLink'),
    other_link: t('otherLink'),
  };
  return typeMap[aiExtract.value.type] || '';
});

const typeIcon = computed(() => {
  if (!aiExtract.value) return null;
  const iconMap = {
    auth_code: CodeRound,
    auth_link: LinkRound,
    service_link: LinkRound,
    subscription_link: LinkRound,
    other_link: LinkRound,
  };
  return iconMap[aiExtract.value.type] || null;
});

const isLink = computed(() => {
  return aiExtract.value && aiExtract.value.type !== 'auth_code';
});

const displayText = computed(() => {
  if (!aiExtract.value) return '';
  // For auth_code, always show the raw result (verification code)
  if (aiExtract.value.type === 'auth_code') {
    return aiExtract.value.result;
  }
  // For links, prefer result_text as display label
  return aiExtract.value.result_text || aiExtract.value.result;
});

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(aiExtract.value.result);
    message.success(t('copySuccess'));
  } catch (e) {
    message.error(t('copyFailed'));
  }
};

const openLink = () => {
  if (isLink.value && aiExtract.value.result) {
    window.open(aiExtract.value.result, '_blank');
  }
};
</script>

<template>
  <div v-if="aiExtract && aiExtract.result" class="ai-extract-info">
    <n-alert v-if="!compact" type="success" closable :theme-overrides="alertThemeOverrides">
      <template #icon>
        <n-icon :component="typeIcon" />
      </template>
      <template #header>
        {{ typeLabel }}
      </template>
      <n-space align="center">
        <n-text v-if="aiExtract.type === 'auth_code'" strong style="font-size: 18px; font-family: monospace;">
          {{ aiExtract.result }}
        </n-text>
        <n-ellipsis v-else style="max-width: 400px;">
          {{ displayText }}
        </n-ellipsis>
        <n-button size="small" @click="copyToClipboard" tertiary>
          <template #icon>
            <n-icon :component="ContentCopyOutlined" />
          </template>
        </n-button>
        <n-button v-if="isLink" size="small" @click="openLink" tertiary type="primary">
          {{ t('open') }}
        </n-button>
      </n-space>
    </n-alert>
    <n-tag v-else type="success" @click="copyToClipboard" style="cursor: pointer;" size="small" :theme-overrides="tagThemeOverrides">
      <template #icon>
        <n-icon :component="typeIcon" />
      </template>
      <n-ellipsis style="max-width: 150px;">
        {{ typeLabel }}: {{ displayText }}
      </n-ellipsis>
    </n-tag>
  </div>
</template>

<style scoped>
.ai-extract-info {
  margin-bottom: 10px;
}
</style>
