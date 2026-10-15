<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useThemeVars } from 'naive-ui';
import { useScopedI18n } from '@/i18n/app'
import { CloudDownloadRound, ReplyFilled, ForwardFilled, FullscreenRound, ImageRound, AttachFileRound,
  MarkEmailReadRound, MarkEmailUnreadRound, MoreHorizRound, DeleteOutlineRound, TextSnippetRound, InfoOutlined } from '@vicons/material'
import ShadowHtmlComponent from "./ShadowHtmlComponent.vue";
import AiExtractInfo from "./AiExtractInfo.vue";
import { getDownloadEmlUrl } from '../utils/email-parser';
import { blockRemoteContent } from '../utils/remote-content-policy';
import { utcToLocalDate } from '../utils';
import { useGlobalState } from '../store';

const { preferShowTextMail, useIframeShowMail, useUTCDate, isDark, autoLoadRemoteImages } = useGlobalState();

const { t } = useScopedI18n('components.MailContentRenderer')
const themeVars = useThemeVars();
const replyColor = computed(() => isDark.value ? themeVars.value.infoColor : themeVars.value.infoColorPressed);
const neutralActionColor = computed(() =>
  `color-mix(in srgb, ${themeVars.value.textColor2} 50%, ${themeVars.value.textColor3})`);
const deleteColor = computed(() => isDark.value
  ? `color-mix(in srgb, ${themeVars.value.errorColor} 65%, ${themeVars.value.textColor1})`
  : themeVars.value.errorColorPressed);

const props = defineProps({
  mail: {
    type: Object,
    required: true
  },
  showEMailTo: {
    type: Boolean,
    default: true
  },
  enableUserDeleteEmail: {
    type: Boolean,
    default: false
  },
  showReply: {
    type: Boolean,
    default: false
  },
  showSaveS3: {
    type: Boolean,
    default: false
  },
  enableMailReadStatus: {
    type: Boolean,
    default: false
  },
  // 回调函数 props
  onDelete: {
    type: Function,
    default: () => { }
  },
  onReply: {
    type: Function,
    default: () => { }
  },
  onForward: {
    type: Function,
    default: () => { }
  },
  onSaveToS3: {
    type: Function,
    default: () => { }
  },
  onUpdateMailReadStatus: {
    type: Function,
    default: () => { }
  }
});

const showTextMail = ref(preferShowTextMail.value);
const showAttachments = ref(false);
const curAttachments = ref([]);
const attachmentLoding = ref(false);
const readStatusUpdating = ref(false);
const showFullscreen = ref(false);
const showMoreActions = ref(false);
const showMailDetails = ref(false);
const moreActionsButton = ref(null);
const downloadMailButton = ref(null);

watch(showMoreActions, async (show) => {
  if (!show) return;
  await nextTick();
  if (showMoreActions.value) downloadMailButton.value?.$el.focus();
});

// Per-mail consent, deliberately independent of the global setting: it only
// ever turns true when the user clicks "load images" for this specific mail,
// and resets when a different mail is shown.
const showRemoteImages = ref(false);
watch(() => props.mail.id, () => {
  showRemoteImages.value = false;
  showMoreActions.value = false;
  showMailDetails.value = false;
});

const processedMail = computed(() => {
  if (autoLoadRemoteImages.value || showRemoteImages.value) {
    return { message: props.mail.message, blocked: 0 };
  }
  const { html, blocked } = blockRemoteContent(props.mail.message);
  return { message: html, blocked };
});

const handleLoadRemoteImages = () => {
  showRemoteImages.value = true;
};

const handleDelete = () => {
  props.onDelete();
};

const handleViewAttachments = () => {
  curAttachments.value = props.mail.attachments;
  showAttachments.value = true;
};

const handleReply = () => {
  props.onReply();
};

const handleForward = () => {
  props.onForward();
};

const closeMoreActions = () => {
  showMoreActions.value = false;
  moreActionsButton.value?.$el.focus();
};

const toggleTextMail = () => {
  showTextMail.value = !showTextMail.value;
  closeMoreActions();
};

const openFullscreen = () => {
  showFullscreen.value = true;
  closeMoreActions();
};

const openMailDetails = () => {
  showMailDetails.value = true;
  closeMoreActions();
};

const handleUpdateMailReadStatus = async () => {
  readStatusUpdating.value = true;
  closeMoreActions();
  try {
    await props.onUpdateMailReadStatus();
  } finally {
    readStatusUpdating.value = false;
  }
};


const handleSaveToS3 = async (filename, blob) => {
  attachmentLoding.value = true;
  try {
    await props.onSaveToS3(filename, blob);
  } finally {
    attachmentLoding.value = false;
  }
};

</script>

<template>
  <div class="mail-content-renderer">
    <div class="mail-details">
      <div class="mail-address">
        <n-text depth="3" class="mail-address-label">{{ t('from') }}</n-text>
        <n-text depth="2">{{ mail.source }}</n-text>
      </div>
      <div v-if="showEMailTo" class="mail-address">
        <n-text depth="3" class="mail-address-label">{{ t('to') }}</n-text>
        <n-text depth="2">{{ mail.address }}</n-text>
      </div>
      <div class="mail-details-footer">
        <n-text depth="3">{{ utcToLocalDate(mail.created_at, useUTCDate) }}</n-text>
      </div>
    </div>
    <n-flex class="mail-actions" align="center" justify="space-between" :size="4">
      <n-space v-if="showReply || mail.attachments?.length" align="center" :size="4">
        <n-button v-if="showReply" size="small" quaternary type="info" :color="replyColor" @click="handleReply">
          <template #icon><n-icon :component="ReplyFilled" /></template>
          {{ t('reply') }}
        </n-button>
        <n-button v-if="showReply" size="small" quaternary :color="neutralActionColor" @click="handleForward">
          <template #icon><n-icon :component="ForwardFilled" /></template>
          {{ t('forward') }}
        </n-button>
        <n-button v-if="mail.attachments?.length" size="small" quaternary :color="neutralActionColor"
          :title="t('attachments')" :aria-label="t('attachments')" @click="handleViewAttachments">
          <template #icon><n-icon :component="AttachFileRound" /></template>
          <n-space align="center" :size="4">
            <span>{{ t('attachments') }}</span>
            <n-badge :value="mail.attachments.length" :color="themeVars.tagColor" />
          </n-space>
        </n-button>
      </n-space>
      <div class="mail-secondary-actions">
        <n-space align="center" :wrap="false" :size="4">
          <n-popover v-model:show="showMoreActions" trigger="click" placement="bottom-end" :show-arrow="false">
            <template #trigger>
              <n-button ref="moreActionsButton" size="small" quaternary :color="neutralActionColor" :title="t('moreActions')" :aria-label="t('moreActions')"
                :aria-expanded="showMoreActions" @keydown.esc.stop.prevent="closeMoreActions">
                <template #icon><n-icon :component="MoreHorizRound" /></template>
                {{ t('more') }}
              </n-button>
            </template>
            <div class="mail-more-actions" @keydown.esc.stop.prevent="closeMoreActions">
              <n-button ref="downloadMailButton" tag="a" target="_blank" block quaternary size="small" :download="mail.id + '.eml'"
                :href="getDownloadEmlUrl(mail.raw)" @click="closeMoreActions">
                <template #icon><n-icon :component="CloudDownloadRound" /></template>
                {{ t('downloadMail') }}
              </n-button>
              <n-button v-if="enableMailReadStatus" block quaternary size="small" :loading="readStatusUpdating"
                @click="handleUpdateMailReadStatus">
                <template #icon>
                  <n-icon :component="mail.is_unread === 1 ? MarkEmailReadRound : MarkEmailUnreadRound" />
                </template>
                {{ mail.is_unread === 1 ? t('markAsRead') : t('markAsUnread') }}
              </n-button>
              <n-button block quaternary size="small" @click="toggleTextMail">
                <template #icon><n-icon :component="TextSnippetRound" /></template>
                {{ showTextMail ? t('showHtmlMail') : t('showTextMail') }}
              </n-button>
              <n-button block quaternary size="small" @click="openFullscreen">
                <template #icon><n-icon :component="FullscreenRound" /></template>
                {{ t('fullscreen') }}
              </n-button>
              <n-button block quaternary size="small" @click="openMailDetails">
                <template #icon><n-icon :component="InfoOutlined" /></template>
                {{ t('mailDetails') }}
              </n-button>
            </div>
          </n-popover>
          <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="handleDelete">
            <template #trigger>
              <n-button size="small" quaternary type="error" :color="deleteColor" :title="t('delete')" :aria-label="t('delete')">
                <template #icon><n-icon :component="DeleteOutlineRound" /></template>
                {{ t('delete') }}
              </n-button>
            </template>
            {{ t('deleteMailTip') }}
          </n-popconfirm>
        </n-space>
      </div>
    </n-flex>

    <!-- 外部资源阻断提示 -->
    <n-alert v-if="processedMail.blocked" type="warning" :show-icon="false" :bordered="false"
      class="remote-images-banner">
      <n-space align="center" justify="space-between">
        <span>{{ t('remoteImagesBlocked', { count: processedMail.blocked }) }}</span>
        <n-button size="tiny" tertiary type="warning" @click="handleLoadRemoteImages">
          <template #icon>
            <n-icon :component="ImageRound" />
          </template>
          {{ t('loadRemoteImages') }}
        </n-button>
      </n-space>
    </n-alert>

    <!-- AI 提取信息 -->
    <AiExtractInfo :metadata="mail.metadata" />

    <!-- 邮件内容 -->
    <div class="mail-content" :class="{ 'dark-mode': isDark }">
      <pre v-if="showTextMail" class="mail-text">{{ mail.text }}</pre>
      <iframe v-else-if="useIframeShowMail" :srcdoc="processedMail.message" class="mail-iframe">
      </iframe>
      <ShadowHtmlComponent v-else :key="mail.id" :htmlContent="processedMail.message" :isDark="isDark" class="mail-html" />
    </div>
  </div>

  <n-modal v-model:show="showMailDetails" preset="card" title="Mail details" :bordered="false"
    class="mail-details-modal" style="width: min(480px, calc(100vw - 32px));">
    <n-descriptions :column="1" label-placement="left" :content-style="{ overflowWrap: 'anywhere' }">
      <n-descriptions-item v-if="mail.subject" label="Subject">{{ mail.subject }}</n-descriptions-item>
      <n-descriptions-item label="From">{{ mail.source }}</n-descriptions-item>
      <n-descriptions-item v-if="mail.originalSource && mail.originalSource !== mail.source"
        label="SMTP envelope sender">{{ mail.originalSource }}</n-descriptions-item>
      <n-descriptions-item v-if="showEMailTo" label="To">{{ mail.address }}</n-descriptions-item>
      <n-descriptions-item label="Received at">{{ utcToLocalDate(mail.created_at, useUTCDate) }}</n-descriptions-item>
      <n-descriptions-item v-if="enableMailReadStatus && (mail.is_unread === 0 || mail.is_unread === 1)"
        label="Status">{{ mail.is_unread === 1 ? 'Unread' : 'Read' }}</n-descriptions-item>
      <n-descriptions-item v-if="mail.attachments?.length" :label="`Attachments (${mail.attachments.length})`">
        <n-space vertical :size="4">
          <span v-for="attachment in mail.attachments" :key="attachment.id">
            {{ attachment.filename || '—' }} · {{ attachment.size }}
          </span>
        </n-space>
      </n-descriptions-item>
      <n-descriptions-item v-if="mail.message_id" label="Message-ID">{{ mail.message_id }}</n-descriptions-item>
      <n-descriptions-item label="ID">{{ mail.id }}</n-descriptions-item>
    </n-descriptions>
  </n-modal>

  <n-drawer v-model:show="showFullscreen" width="100%" placement="bottom" :trap-focus="false" :block-scroll="false"
    style="height: 100vh;">
    <n-drawer-content :title="mail.subject" closable>
      <div class="fullscreen-mail-content" :class="{ 'dark-mode': isDark }">
        <pre v-if="showTextMail" class="mail-text">{{ mail.text }}</pre>
        <iframe v-else-if="useIframeShowMail" :srcdoc="processedMail.message" class="mail-iframe">
        </iframe>
        <ShadowHtmlComponent v-else :key="mail.id" :htmlContent="processedMail.message" :isDark="isDark" class="mail-html" />
      </div>
    </n-drawer-content>
  </n-drawer>

  <!-- 附件模态框 -->
  <n-modal v-model:show="showAttachments" preset="dialog" title="Dialog">
    <template #header>
      <div>{{ t('attachments') }}</div>
    </template>
    <n-spin v-model:show="attachmentLoding">
      <n-list hoverable clickable>
        <n-list-item v-for="row in curAttachments" v-bind:key="row.id">
          <n-thing class="center" :title="row.filename">
            <template #description>
              <n-space>
                <n-tag type="info">
                  Size: {{ row.size }}
                </n-tag>
                <n-button v-if="showSaveS3" @click="handleSaveToS3(row.filename, row.blob)" ghost type="info"
                  size="small">
                  {{ t('saveToS3') }}
                </n-button>
              </n-space>
            </template>
          </n-thing>
          <template #suffix>
            <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="row.filename"
              :href="row.url">
              <n-icon :component="CloudDownloadRound" />
            </n-button>
          </template>
        </n-list-item>
      </n-list>
    </n-spin>
  </n-modal>
</template>

<style scoped>
.mail-content-renderer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.mail-details {
  font-size: 13px;
  line-height: 22px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.mail-address {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px;
  overflow-wrap: anywhere;
}

.mail-address-label {
  font-size: 11px;
}

.mail-details-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
  font-size: 12px;
}

.mail-secondary-actions {
  margin-left: auto;
}

.mail-actions :deep(.n-badge-sup) {
  color: v-bind('themeVars.textColor2');
}

.mail-more-actions {
  width: 200px;
  max-width: calc(100vw - 48px);
}

.mail-more-actions :deep(.n-button) {
  justify-content: flex-start;
  height: auto;
  min-height: 32px;
  padding: 6px 8px;
}

.mail-more-actions :deep(.n-button__content) {
  white-space: normal;
  text-align: left;
}

/* Let the banner's inner space fill the alert so the button sits on the right. */
.remote-images-banner :deep(.n-space) {
  width: 100%;
}

.mail-content {
  margin-top: 10px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.mail-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

.dark-mode .mail-text {
  color: #e0e0e0;
}

.mail-iframe {
  width: 100%;
  height: 100%;
  border: none;
  min-height: 400px;
}

.dark-mode .mail-iframe {
  background-color: #fff;
}

.mail-html {
  width: 100%;
  height: 100%;
}

.center {
  text-align: center;
}

.fullscreen-mail-content {
  height: calc(100vh - 120px);
  overflow: auto;
}

.fullscreen-mail-content .mail-iframe {
  min-height: calc(100vh - 120px);
}
</style>
