<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useScopedI18n } from '@/i18n/app'
import { CloudDownloadRound, ReplyFilled, ForwardFilled, FullscreenRound } from '@vicons/material'
import ShadowHtmlComponent from "./ShadowHtmlComponent.vue";
import AiExtractInfo from "./AiExtractInfo.vue";
import { getDownloadEmlUrl } from '../utils/email-parser';
import { utcToLocalDate } from '../utils';
import { useGlobalState } from '../store';

const { preferShowTextMail, useIframeShowMail, useUTCDate, isDark, autoLoadRemoteContent } = useGlobalState();

const { t } = useScopedI18n('components.MailContentRenderer')

const blockedRemoteContentPlaceholder = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80">
  <rect width="320" height="80" rx="8" fill="#f3f4f6"/>
  <text x="160" y="45" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#6b7280">Remote content blocked</text>
</svg>
`)}`;

const hasRemoteUrl = (value: string | null) => /(?:^|,)\s*(?:https?:)?\/\//i.test(value || '');

const blockRemoteImages = (html?: string | null) => {
  if (!html || typeof DOMParser !== 'function') return html || '';

  const hasDocumentShell = /<!doctype|<html[\s>]/i.test(html);
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const image of doc.querySelectorAll('img')) {
    const src = image.getAttribute('src');
    const srcset = image.getAttribute('srcset');
    if (!hasRemoteUrl(src) && !hasRemoteUrl(srcset)) continue;

    if (src) image.setAttribute('data-blocked-src', src);
    if (srcset) image.setAttribute('data-blocked-srcset', srcset);
    image.removeAttribute('srcset');
    image.setAttribute('src', blockedRemoteContentPlaceholder);
  }

  return hasDocumentShell ? `<!doctype html>\n${doc.documentElement.outerHTML}` : doc.body.innerHTML;
};

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
  }
});

const showTextMail = ref(preferShowTextMail.value);
const showAttachments = ref(false);
const curAttachments = ref([]);
const attachmentLoding = ref(false);
const showFullscreen = ref(false);
const loadRemoteContentForCurrentMail = ref(false);
const shouldLoadRemoteContent = computed(() => autoLoadRemoteContent.value || loadRemoteContentForCurrentMail.value);
const mailHtmlContent = computed(() => shouldLoadRemoteContent.value
  ? (props.mail.message || '')
  : blockRemoteImages(props.mail.message));

watch(() => props.mail.id, () => {
  loadRemoteContentForCurrentMail.value = false;
});

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
    <!-- 邮件信息标签 -->
    <n-space>
      <n-tag type="info">
        ID: {{ mail.id }}
      </n-tag>
      <n-tag type="info">
        {{ utcToLocalDate(mail.created_at, useUTCDate.value) }}
      </n-tag>
      <n-tag type="info">
        FROM: {{ mail.source }}
      </n-tag>
      <n-tag v-if="showEMailTo" type="info">
        TO: {{ mail.address }}
      </n-tag>

      <!-- 操作按钮 -->
      <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="handleDelete">
        <template #trigger>
          <n-button tertiary type="error" size="small">{{ t('delete') }}</n-button>
        </template>
        {{ t('deleteMailTip') }}
      </n-popconfirm>

      <n-button v-if="mail.attachments && mail.attachments.length > 0" size="small" tertiary type="info"
        @click="handleViewAttachments">
        {{ t('attachments') }}
      </n-button>

      <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="mail.id + '.eml'"
        :href="getDownloadEmlUrl(mail.raw)">
        <template #icon>
          <n-icon :component="CloudDownloadRound" />
        </template>
        {{ t('downloadMail') }}
      </n-button>

      <n-button v-if="showReply" size="small" tertiary type="info" @click="handleReply">
        <template #icon>
          <n-icon :component="ReplyFilled" />
        </template>
        {{ t('reply') }}
      </n-button>

      <n-button v-if="showReply" size="small" tertiary type="info" @click="handleForward">
        <template #icon>
          <n-icon :component="ForwardFilled" />
        </template>
        {{ t('forward') }}
      </n-button>

      <n-button size="small" tertiary type="info" @click="showTextMail = !showTextMail">
        {{ showTextMail ? t('showHtmlMail') : t('showTextMail') }}
      </n-button>

      <n-button size="small" tertiary type="info" @click="showFullscreen = true">
        <template #icon>
          <n-icon :component="FullscreenRound" />
        </template>
        {{ t('fullscreen') }}
      </n-button>

      <n-button v-if="!showTextMail && !shouldLoadRemoteContent" size="small" tertiary type="info"
        @click="loadRemoteContentForCurrentMail = true">
        {{ t('loadRemoteContent') }}
      </n-button>

    </n-space>

    <!-- AI 提取信息 -->
    <AiExtractInfo :metadata="mail.metadata" />

    <!-- 邮件内容 -->
    <div class="mail-content" :class="{ 'dark-mode': isDark }">
      <pre v-if="showTextMail" class="mail-text">{{ mail.text }}</pre>
      <iframe v-else-if="useIframeShowMail" :srcdoc="mailHtmlContent" class="mail-iframe">
      </iframe>
      <ShadowHtmlComponent v-else :key="mail.id" :htmlContent="mailHtmlContent" :isDark="isDark" class="mail-html" />
    </div>
  </div>

  <n-drawer v-model:show="showFullscreen" width="100%" placement="bottom" :trap-focus="false" :block-scroll="false"
    style="height: 100vh;">
    <n-drawer-content :title="mail.subject" closable>
      <div class="fullscreen-mail-content" :class="{ 'dark-mode': isDark }">
        <pre v-if="showTextMail" class="mail-text">{{ mail.text }}</pre>
        <iframe v-else-if="useIframeShowMail" :srcdoc="mailHtmlContent" class="mail-iframe">
        </iframe>
        <ShadowHtmlComponent v-else :key="mail.id" :htmlContent="mailHtmlContent" :isDark="isDark" class="mail-html" />
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
}

.mail-content {
  margin-top: 10px;
  flex: 1;
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
