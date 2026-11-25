<script setup>
import { computed } from 'vue';
import { useThemeVars } from 'naive-ui';
import { useGlobalState } from '../store';
import { utcToLocalDate } from '../utils';
import AiExtractInfo from './AiExtractInfo.vue';
import { useScopedI18n } from '@/i18n/app';

const { useUTCDate, isDark } = useGlobalState();
const themeVars = useThemeVars();
const mutedTextColor = computed(() => isDark.value
  ? themeVars.value.textColor3
  : `color-mix(in srgb, ${themeVars.value.textColor3} 65%, ${themeVars.value.textColor2})`);
const { t } = useScopedI18n('components.MailContentRenderer');

const props = defineProps({
  mail: { type: Object, required: true },
  showEMailTo: { type: Boolean, default: true },
  enableMailReadStatus: { type: Boolean, default: false },
  previewLineClamp: { type: Number, default: 0 },
});

const receivedAt = computed(() => new Date(`${props.mail.created_at} UTC`));
</script>

<template>
  <div class="mail-summary">
    <n-flex align="center" :wrap="false" :size="6">
      <div class="mail-summary-sender" :title="mail.source">
        <span v-if="enableMailReadStatus && mail.is_unread === 1" class="mail-summary-unread-dot" />
        <n-ellipsis>
          <n-text v-if="showEMailTo" depth="3" class="mail-summary-muted">{{ t('from') }}: </n-text><n-text depth="2">{{ mail.source || '—' }}</n-text>
        </n-ellipsis>
      </div>
      <n-text depth="3" class="mail-summary-date mail-summary-muted" :title="utcToLocalDate(mail.created_at, useUTCDate)">
        <n-time v-if="!Number.isNaN(receivedAt.getTime())" :time="receivedAt"
          :time-zone="useUTCDate ? 'UTC' : undefined" format="yy/MM/dd" />
        <template v-else>{{ utcToLocalDate(mail.created_at, useUTCDate) }}</template>
      </n-text>
    </n-flex>
    <div v-if="showEMailTo" class="mail-summary-recipient">
      <n-ellipsis>
        <n-text depth="3" class="mail-summary-muted">{{ t('to') }}: </n-text><n-text depth="2">{{ mail.address }}</n-text>
      </n-ellipsis>
    </div>
    <div class="mail-summary-subject" :title="`ID: ${mail.id}\n${mail.subject || ''}`">
      <n-ellipsis><n-text strong depth="1">{{ mail.subject || '—' }}</n-text></n-ellipsis>
    </div>
    <div v-if="mail.text && previewLineClamp > 0" class="mail-summary-preview">
      <n-ellipsis :line-clamp="previewLineClamp" :tooltip="false"><n-text depth="3" class="mail-summary-muted">{{ mail.text }}</n-text></n-ellipsis>
    </div>
    <AiExtractInfo :metadata="mail.metadata" compact />
  </div>
</template>

<style scoped>
.mail-summary {
  min-width: 0;
  width: 100%;
  line-height: 20px;
}

.mail-summary-sender {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  font-size: 13px;
}

.mail-summary :deep(.n-ellipsis) {
  min-width: 0;
}

.mail-summary-sender :deep(.n-ellipsis) {
  flex: 1;
}

.mail-summary-recipient {
  margin-top: 4px;
}

.mail-summary-recipient :deep(.n-ellipsis) {
  display: block;
}

.mail-summary-subject {
  font-size: 15px;
  margin-top: 4px;
}

.mail-summary-muted {
  color: v-bind(mutedTextColor);
}

.mail-summary-preview {
  font-size: 13px;
  line-height: 18px;
  margin-top: 8px;
}

.mail-summary-preview :deep(.n-ellipsis) {
  display: -webkit-box;
  overflow-wrap: anywhere;
}

.mail-summary-recipient,
.mail-summary-date {
  font-size: 12px;
}

.mail-summary-unread-dot {
  flex: 0 0 7px;
  height: 7px;
  border-radius: 50%;
  background: v-bind('themeVars.infoColor');
}

.mail-summary :deep(.ai-extract-info) {
  margin: 2px 0 0;
}

.mail-summary :deep(.n-tag) {
  max-width: 100%;
}

.mail-summary :deep(.n-tag__content) {
  min-width: 0;
}
</style>
