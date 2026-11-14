<script setup>
import { watch, onMounted, ref, onBeforeUnmount, computed, nextTick } from "vue";
import { useMessage, useThemeVars } from 'naive-ui'
import { useElementSize } from '@vueuse/core'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import { CloudDownloadRound, ArrowBackIosNewFilled, ArrowForwardIosFilled, InboxRound } from '@vicons/material'
import { useIsMobile } from '../utils/composables'
import { processItem } from '../utils/email-parser'
import { buildReplyModel, buildForwardModel } from '../utils/mail-actions'
import MailContentRenderer from "./MailContentRenderer.vue";
import MailSummary from "./MailSummary.vue";

const message = useMessage()
const themeVars = useThemeVars()
const isMobile = useIsMobile()
const mailbox = ref(null)
const { width: mailboxWidth } = useElementSize(mailbox)
const stackedDesktop = computed(() => mailboxWidth.value > 0 && mailboxWidth.value < 700)
const readerControls = ref(null)
const minSplit = computed(() => mailboxWidth.value ? 220 / mailboxWidth.value : 0)
const maxSplit = computed(() => mailboxWidth.value ? Math.min(0.75, 1 - 368 / mailboxWidth.value) : 0.75)

const props = defineProps({
  enableUserDeleteEmail: {
    type: Boolean,
    default: false,
    required: false
  },
  showEMailTo: {
    type: Boolean,
    default: true,
    required: false
  },
  fetchMailData: {
    type: Function,
    default: () => { },
    required: true
  },
  deleteMail: {
    type: Function,
    default: () => { },
    required: false
  },
  showReply: {
    type: Boolean,
    default: false,
    required: false
  },
  showSaveS3: {
    type: Boolean,
    default: false,
    required: false
  },
  saveToS3: {
    type: Function,
    default: (mail_id, filename, blob) => { },
    required: false
  },
  showFilterInput: {
    type: Boolean,
    default: false,
    required: false
  },
  enableMailReadStatus: {
    type: Boolean,
    default: false
  },
  updateMailReadStatus: {
    type: Function,
    default: () => { }
  },
})

const localFilterKeyword = ref('')

const {
  isDark, mailboxSplitSize, mailListView, mailListPreviewLineClamp, indexTab, loading,
  autoRefresh, configAutoRefreshInterval, sendMailModel
} = useGlobalState()
const autoRefreshInterval = ref(configAutoRefreshInterval.value)
const rawData = ref([])
const timer = ref(null)

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const mailListPreviewLineClampValue = computed(() => {
  const value = Number(mailListPreviewLineClamp.value)
  if (!Number.isFinite(value)) return 0
  return Math.min(5, Math.max(0, Math.round(value)))
})

// Computed property for filtered data (only filter current page)
const data = computed(() => {
  if (!localFilterKeyword.value || localFilterKeyword.value.trim() === '') {
    return rawData.value;
  }
  const keyword = localFilterKeyword.value.toLowerCase();
  return rawData.value.filter(mail => {
    // Search in subject, text, message fields
    const searchFields = [
      mail.subject || '',
      mail.text || '',
      mail.message || ''
    ].map(field => field.toLowerCase());
    return searchFields.some(field => field.includes(keyword));
  });
})

const hasNoFilterMatches = computed(() => Boolean(localFilterKeyword.value.trim()) && rawData.value.length > 0 && data.value.length === 0)

const openMail = (mail) => {
  curMail.value = mail
  if (mail?.is_unread !== 1 || !props.enableMailReadStatus) return
  mail.is_unread = 0
  void props.updateMailReadStatus(mail.id, false).catch(() => {
    mail.is_unread = 1
  })
}

const toggleCurrentMailUnread = async () => {
  if (!curMail.value || !props.enableMailReadStatus) return
  const mail = curMail.value
  const previousValue = mail.is_unread
  const isUnread = previousValue !== 1
  mail.is_unread = isUnread ? 1 : 0
  try {
    await props.updateMailReadStatus(mail.id, isUnread)
    message.success(t("success"))
  } catch {
    mail.is_unread = previousValue
  }
}

const canGoPrevMail = computed(() => {
  if (!curMail.value) return false
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)
  return currentIndex > 0 || page.value > 1
})

const canGoNextMail = computed(() => {
  if (!curMail.value) return false
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)
  return currentIndex < data.value.length - 1 || count.value > page.value * pageSize.value
})

const prevMail = async () => {
  if (!canGoPrevMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex > 0) {
    openMail(data.value[currentIndex - 1])
  } else if (page.value > 1) {
    page.value--
    if (await refresh() && data.value.length > 0) {
      openMail(data.value[data.value.length - 1])
    }
  }
}

const nextMail = async () => {
  if (!canGoNextMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex < data.value.length - 1) {
    openMail(data.value[currentIndex + 1])
  } else if (count.value > page.value * pageSize.value) {
    page.value++
    if (await refresh() && data.value.length > 0) {
      openMail(data.value[0])
    }
  }
}

const curMail = ref(null);

const multiActionMode = ref(false)
const showMultiActionDownload = ref(false)
const showMultiActionDelete = ref(false)
const multiActionDownloadZip = ref({})
const multiActionDeleteProgress = ref({ percentage: 0, tip: '0/0' })

const { t } = useScopedI18n('components.MailBox')

const setupAutoRefresh = async (autoRefresh) => {
  // auto refresh every configAutoRefreshInterval seconds
  autoRefreshInterval.value = configAutoRefreshInterval.value;
  if (autoRefresh) {
    clearInterval(timer.value);
    let lastTick = Date.now()
    timer.value = setInterval(async () => {
      if (document.hidden) return
      const now = Date.now()
      const elapsed = Math.floor((now - lastTick) / 1000)
      if (elapsed <= 0) return
      lastTick += elapsed * 1000
      if (loading.value || activeRefresh || page.value !== 1 || multiActionMode.value) return
      autoRefreshInterval.value -= elapsed
      if (autoRefreshInterval.value <= 0) {
        autoRefreshInterval.value = configAutoRefreshInterval.value;
        await refresh({ background: true });
      }
    }, 1000)
  } else {
    clearInterval(timer.value)
    timer.value = null
  }
}

watch(autoRefresh, async (autoRefresh, old) => {
  setupAutoRefresh(autoRefresh)
}, { immediate: true })

watch([page, pageSize], async ([page, pageSize], [, oldPageSize]) => {
  if (activeRefresh || page !== loadedPage || pageSize !== oldPageSize) await refresh()
})

const releaseAttachments = (mails, retained = []) => {
  const inUse = new Set(retained.flatMap(mail => (mail.attachments || []).map(attachment => attachment.url)))
  for (const mail of mails) {
    for (const { url } of mail.attachments || []) {
      if (!inUse.has(url)) URL.revokeObjectURL(url)
    }
  }
}

let activeRefresh = null
let loadedPage = 1

const refresh = ({ force = false, background = false } = {}) => {
  const limit = pageSize.value
  const offset = (page.value - 1) * limit
  if (!force && activeRefresh?.limit === limit && activeRefresh.offset === offset
    && (!activeRefresh.background || background)) return activeRefresh.promise

  const request = { limit, offset, background }
  activeRefresh = request
  request.promise = fetchPage(request)
  return request.promise
}

const fetchPage = async (request) => {
  try {
    const { results, count: totalCount } = await props.fetchMailData(request.limit, request.offset, { showLoading: !request.background });
    if (request !== activeRefresh) return
    if (request.offset > 0 && !results.length) {
      page.value = 1
      return
    }
    const previousMails = new Map(rawData.value.map(mail => [mail.id, mail]))
    const mails = await Promise.all(results.map(async (item) => {
      item.checked = false;
      const previous = previousMails.get(item.id)
      if (!previous || previous.raw !== item.raw || previous.originalSource !== item.source) {
        return await processItem(item);
      }
      const { source, originalSource, subject, message, text, attachments } = previous
      return { ...item, source, originalSource, subject, message, text, attachments }
    }));
    if (request !== activeRefresh || (request.background
      && (!autoRefresh.value || page.value !== 1 || request.limit !== pageSize.value || multiActionMode.value))) {
      releaseAttachments(mails, [...rawData.value, ...previousMails.values(), curMail.value].filter(Boolean))
      return
    }
    const previousRows = rawData.value
    const previousReader = curMail.value
    loadedPage = request.offset / request.limit + 1
    rawData.value = mails
    void nextTick(() => releaseAttachments([...previousRows, previousReader].filter(Boolean),
      [...rawData.value, curMail.value].filter(Boolean)))
    if (request.offset === 0) {
      count.value = totalCount;
    }
    if (request.background && curMail.value) {
      curMail.value = mails.find(mail => mail.id === curMail.value.id) || curMail.value
      return
    }
    curMail.value = null;
    if (!isMobile.value && !mailListView.value && data.value.length > 0) {
      curMail.value = data.value[0];
    }
    return true
  } catch (error) {
    if (request !== activeRefresh) return
    message.error(error.message || "error");
    page.value = loadedPage
  } finally {
    if (request === activeRefresh) activeRefresh = null
  }
};

const backFirstPageAndRefresh = async () => {
  page.value = 1;
  await refresh();
}

let mobileReaderTrigger = null

const openMobileMail = (row, event) => {
  const item = event.currentTarget
  mobileReaderTrigger = item.contains(document.activeElement) ? document.activeElement : item
  clickRow(row, event)
}

const restoreMobileReaderFocus = () => {
  mobileReaderTrigger?.focus({ preventScroll: true })
  mobileReaderTrigger = null
}

const mailList = ref(null)
const backToListButton = ref(null)

const closeListMail = async () => {
  const id = curMail.value.id
  curMail.value = null
  await nextTick()
  mailList.value?.querySelector(`[data-mail-id="${id}"] .mail-summary-open`)?.focus()
}

const clickRow = async (row, event) => {
  if (multiActionMode.value) {
    row.checked = !row.checked;
    curMail.value = row;
    return;
  }
  if (mailListView.value && curMail.value?.id === row.id) {
    await closeListMail()
    return;
  }
  openMail(row);
  if (event?.detail === 0 && !isMobile.value && mailListView.value) {
    await nextTick()
    backToListButton.value?.$el.focus()
  } else if (!isMobile.value && stackedDesktop.value) {
    void nextTick(() => readerControls.value?.scrollIntoView({ block: 'nearest' }))
  }
};


const mailItemClass = (row) => {
  return curMail.value && row.id == curMail.value.id ? (isDark.value ? 'overlay overlay-dark-backgroud' : 'overlay overlay-light-backgroud') : '';
};

const deleteMail = async () => {
  try {
    await props.deleteMail(curMail.value.id);
    message.success(t("success"));
    curMail.value = null;
    await refresh({ force: true });
  } catch (error) {
    message.error(error.message || "error");
  }
};

const replyMail = async () => {
  Object.assign(sendMailModel.value, buildReplyModel(curMail.value, t('reply')));
  indexTab.value = 'sendmail';
};

const forwardMail = async () => {
  Object.assign(sendMailModel.value, buildForwardModel(curMail.value, t('forwardMail')));
  indexTab.value = 'sendmail';
};

const onSpiltSizeChange = (size) => {
  mailboxSplitSize.value = size;
}

const saveToS3Proxy = async (filename, blob) => {
  await props.saveToS3(curMail.value.id, filename, blob);
}

const multiActionModeClick = (enableMulti) => {
  if (enableMulti) {
    data.value.forEach((item) => {
      item.checked = false;
    });
    multiActionMode.value = true;
  } else {
    multiActionMode.value = false;
    data.value.forEach((item) => {
      item.checked = false;
    });
  }
}

const multiActionSelectAll = (checked) => {
  data.value.forEach((item) => {
    item.checked = checked;
  });
}

const multiActionDeleteMail = async () => {
  const deletedIds = new Set()
  try {
    loading.value = true;
    const selectedMails = data.value.filter((item) => item.checked);
    if (selectedMails.length === 0) {
      message.error(t('pleaseSelectMail'));
      return;
    }
    multiActionDeleteProgress.value = {
      percentage: 0,
      tip: `0/${selectedMails.length}`
    };
    showMultiActionDelete.value = true
    for (const [index, mail] of selectedMails.entries()) {
      await props.deleteMail(mail.id);
      deletedIds.add(mail.id)
      multiActionDeleteProgress.value = {
        percentage: Math.floor((index + 1) / selectedMails.length * 100),
        tip: `${index + 1}/${selectedMails.length}`
      };
    }
  } catch (error) {
    showMultiActionDelete.value = false
    message.error(error.message || "error");
  } finally {
    rawData.value = rawData.value.filter(mail => !deletedIds.has(mail.id))
    count.value = Math.max(0, count.value - deletedIds.size)
    if (deletedIds.has(curMail.value?.id)) curMail.value = null
    loading.value = false;
  }
  if (multiActionDeleteProgress.value.percentage === 100) {
    message.success(t("success"));
    await refresh({ force: true });
  }
}

const multiActionDownload = async () => {
  try {
    loading.value = true;
    const selectedMails = data.value.filter((item) => item.checked);
    if (selectedMails.length === 0) {
      message.error(t('pleaseSelectMail'));
      return;
    }
    const JSZipModlue = await import('jszip');
    const JSZip = JSZipModlue.default;
    const zip = new JSZip();
    for (const mail of selectedMails) {
      zip.file(`${mail.id}.eml`, mail.raw);
    }
    multiActionDownloadZip.value = {
      url: URL.createObjectURL(await zip.generateAsync({ type: "blob" })),
      filename: `mails-${new Date().toISOString().replace(/:/g, '-')}.zip`
    }
    showMultiActionDownload.value = true;
  } catch (error) {
    message.error(error.message || "error");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await refresh();
});

onBeforeUnmount(() => {
  activeRefresh = null
  const mails = [...rawData.value, curMail.value].filter(Boolean)
  void nextTick(() => releaseAttachments(mails))
  clearInterval(timer.value)
})
</script>

<template>
  <div ref="mailbox">
    <div v-if="!isMobile" class="left">
      <div style="margin-bottom: 10px;">
        <n-space v-if="multiActionMode" align="center">
          <n-button @click="multiActionModeClick(false)" tertiary>
            {{ t('cancelMultiAction') }}
          </n-button>
          <n-button @click="multiActionSelectAll(true)" tertiary>
            {{ t('selectAll') }}
          </n-button>
          <n-button @click="multiActionSelectAll(false)" tertiary>
            {{ t('unselectAll') }}
          </n-button>
          <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="multiActionDeleteMail">
            <template #trigger>
              <n-button tertiary type="error" :disabled="!data.some(mail => mail.checked)">{{ t('delete') }}</n-button>
            </template>
            {{ t('deleteMailTip') }}
          </n-popconfirm>
          <n-button @click="multiActionDownload" tertiary type="info">
            <template #icon>
              <n-icon :component="CloudDownloadRound" />
            </template>
            {{ t('downloadMail') }}
          </n-button>
        </n-space>
        <n-space v-else align="center">
          <n-button @click="multiActionModeClick(true)" type="primary" tertiary>
            {{ t('multiAction') }}
          </n-button>
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" :page-sizes="[20, 50, 100]"
            show-size-picker />
          <n-switch v-model:value="autoRefresh" :round="false">
            <template #checked>
              {{ t('refreshAfter', { msg: autoRefreshInterval }) }}
            </template>
            <template #unchecked>
              {{ t('autoRefresh') }}
            </template>
          </n-switch>
          <n-button @click="backFirstPageAndRefresh" type="primary" tertiary>
            {{ t('refresh') }}
          </n-button>
          <n-input v-if="showFilterInput" v-model:value="localFilterKeyword"
            :placeholder="t('keywordQueryTip')" :input-props="{ 'aria-label': t('keywordQueryTip') }" style="width: 200px; display: flex; align-items: center;"
            clearable />
        </n-space>
      </div>
      <n-split class="left" :class="{ 'mail-split-stacked': stackedDesktop }" :disabled="stackedDesktop"
        direction="horizontal" :max="maxSplit" :min="minSplit" :resize-trigger-size="8"
        :size="Math.min(maxSplit, Math.max(minSplit, mailboxSplitSize))" :on-update:size="onSpiltSizeChange" v-if="!mailListView || curMail">
        <template #resize-trigger>
          <div class="split-handle">
            <div class="split-handle__grip" />
          </div>
        </template>
        <template #1>
          <div class="mail-list-scroll mail-list-compact">
            <div role="status">
              <n-empty v-if="hasNoFilterMatches" :description="t('noFilterMatches')" />
            </div>
            <n-list v-if="!hasNoFilterMatches" hoverable clickable>
              <n-list-item v-for="row in data" v-bind:key="row.id" @click="clickRow(row, $event)"
                :class="[mailItemClass(row), { 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }]">
                <template #prefix v-if="multiActionMode">
                  <n-checkbox v-model:checked="row.checked" @click.stop />
                </template>
                <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
                  :previewLineClamp="mailListPreviewLineClampValue" />
              </n-list-item>
            </n-list>
          </div>
        </template>
        <template #2>
          <div v-if="curMail" ref="readerControls" style="margin: 8px;">
            <n-flex justify="space-between" align="center">
              <n-space :wrap="false" align="center">
                <n-button v-if="mailListView" ref="backToListButton" @click="closeListMail" text size="small">
                  <template #icon>
                    <n-icon>
                      <ArrowBackIosNewFilled />
                    </n-icon>
                  </template>
                  {{ t('backToList') }}
                </n-button>
                <n-button @click="prevMail" :disabled="!canGoPrevMail" text size="small">
                  <template #icon>
                    <n-icon>
                      <ArrowBackIosNewFilled />
                    </n-icon>
                  </template>
                  {{ t('prevMail') }}
                </n-button>
              </n-space>
              <n-button @click="nextMail" :disabled="!canGoNextMail" text size="small" icon-placement="right">
                <template #icon>
                  <n-icon>
                    <ArrowForwardIosFilled />
                  </n-icon>
                </template>
                {{ t('nextMail') }}
              </n-button>
            </n-flex>
          </div>
          <n-card :bordered="false" v-if="curMail" class="mail-item" :title="curMail.subject"
            style="overflow: auto; max-height: 100vh;">
            <MailContentRenderer :mail="curMail" :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail" :showReply="showReply" :showSaveS3="showSaveS3"
              :enableMailReadStatus="enableMailReadStatus" :onUpdateMailReadStatus="toggleCurrentMailUnread"
              :onDelete="deleteMail" :onReply="replyMail" :onForward="forwardMail" :onSaveToS3="saveToS3Proxy" />
          </n-card>
          <n-card :bordered="false" embedded class="mail-item" v-else>
            <n-result status="info" :title="count === 0 ? t('emptyInbox') : t('pleaseSelectMail')">
              <template #icon>
                <n-icon :component="InboxRound" :size="100" />
              </template>
            </n-result>
          </n-card>
        </template>
      </n-split>
      <div v-else ref="mailList" class="mail-list-scroll mail-list-compact">
        <div role="status">
          <n-empty v-if="hasNoFilterMatches" :description="t('noFilterMatches')" />
        </div>
        <n-list v-if="!hasNoFilterMatches" hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" :data-mail-id="row.id" @click="clickRow(row, $event)"
            :class="[mailItemClass(row), { 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }]">
            <template #prefix v-if="multiActionMode">
              <n-checkbox v-model:checked="row.checked" @click.stop />
            </template>
            <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
              :previewLineClamp="mailListPreviewLineClampValue" />
          </n-list-item>
        </n-list>
      </div>
    </div>
    <div class="left" v-else>
      <n-space justify="space-between" align="center" :size="[8, 8]">
        <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple size="small" />
        <n-switch v-model:value="autoRefresh" size="small" :round="false">
          <template #checked>
            {{ t('refreshAfter', { msg: autoRefreshInterval }) }}
          </template>
          <template #unchecked>
            {{ t('autoRefresh') }}
          </template>
        </n-switch>
        <n-button @click="backFirstPageAndRefresh" tertiary size="small" type="primary">
          {{ t('refresh') }}
        </n-button>
      </n-space>
      <div v-if="showFilterInput" style="padding: 0 10px; margin-top: 8px; margin-bottom: 10px;">
        <n-input v-model:value="localFilterKeyword"
          :placeholder="t('keywordQueryTip')" :input-props="{ 'aria-label': t('keywordQueryTip') }" size="small" clearable />
      </div>
      <div class="mail-list-scroll mail-list-compact">
        <div role="status">
          <n-empty v-if="hasNoFilterMatches" :description="t('noFilterMatches')" />
        </div>
        <n-list v-if="!hasNoFilterMatches" hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" tabindex="-1" @click="openMobileMail(row, $event)"
            :class="{ 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }">
            <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
              :previewLineClamp="mailListPreviewLineClampValue" />
          </n-list-item>
        </n-list>
      </div>
      <n-drawer :show="Boolean(curMail)" :aria-label="curMail?.subject" width="100%" placement="bottom"
        @update:show="show => { if (!show) curMail = null }" @after-leave="restoreMobileReaderFocus"
        style="height: 80vh;">
        <n-drawer-content :title="curMail ? curMail.subject : ''" closable>
          <div v-if="curMail" class="mail-mobile-reader">
            <MailContentRenderer :mail="curMail" :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail" :showReply="showReply" :showSaveS3="showSaveS3"
              :enableMailReadStatus="enableMailReadStatus" :onUpdateMailReadStatus="toggleCurrentMailUnread"
              :onDelete="deleteMail" :onReply="replyMail" :onForward="forwardMail"
              :onSaveToS3="saveToS3Proxy" />
          </div>
        </n-drawer-content>
      </n-drawer>
    </div>
    <n-modal v-model:show="showMultiActionDownload" preset="dialog" :title="t('downloadMail')">
      <n-tag type="info">
        {{ multiActionDownloadZip.filename }}
      </n-tag>
      <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="multiActionDownloadZip.filename"
        :href="multiActionDownloadZip.url">
        <n-icon :component="CloudDownloadRound" />
        {{ t('downloadMail') + " zip" }}
      </n-button>
    </n-modal>
    <n-modal v-model:show="showMultiActionDelete" preset="dialog"
      :title="multiActionDeleteProgress.percentage === 100 ? t('delete') + t('success') : t('delete')"
      :closable="multiActionDeleteProgress.percentage === 100"
      :mask-closable="multiActionDeleteProgress.percentage === 100"
      :close-on-esc="multiActionDeleteProgress.percentage === 100"
      :negative-text="multiActionDeleteProgress.percentage === 100 ? 'OK' : undefined">
      <n-space justify="center">
        <n-progress type="circle" status="error" :percentage="multiActionDeleteProgress.percentage">
          <span style="text-align: center">
            {{ multiActionDeleteProgress.tip }}
          </span>
        </n-progress>
      </n-space>
    </n-modal>
  </div>
</template>

<style scoped>
.left {
  text-align: left;
}

.center {
  text-align: center;
}

.overlay {
  width: 100%;
  height: 100%;
  z-index: 1000;
}

.mail-list-compact :deep(.n-list-item.overlay-dark-backgroud) {
  background-color: rgba(255, 255, 255, 0.1);
}

.mail-list-compact :deep(.n-list-item.overlay-light-backgroud) {
  background-color: rgba(0, 0, 0, 0.1);
}

.mail-item {
  height: 100%;
}

:deep(.mail-item .n-card-header__main) {
  overflow-wrap: anywhere;
}

.mail-mobile-reader {
  min-width: 0;
}

.mail-list-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 60vh;
  max-height: 100vh;
}

.mail-list-compact :deep(.n-list-item) {
  height: auto;
  padding: 12px 14px;
}

.mail-list-compact :deep(.n-list-item:not(.overlay):hover) {
  background-color: v-bind("isDark ? 'rgba(255, 255, 255, 0.04)' : themeVars.hoverColor");
}

.mail-list-scroll :deep(.n-list-item__main) {
  min-width: 0;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.mail-split-stacked {
  flex-direction: column;
}

.mail-split-stacked :deep(.n-split-pane-1) {
  flex: 0 0 auto !important;
}

.mail-split-stacked .mail-list-scroll {
  min-height: 0;
  max-height: 40vh;
}

.split-handle {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.split-handle__grip {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  background-color: var(--n-resize-trigger-color);
  transition: background-color 0.2s;
}

.split-handle:hover .split-handle__grip {
  background-color: var(--n-resize-trigger-color-hover);
}
</style>
