<script setup>
import { watch, onMounted, ref, onBeforeUnmount, computed } from "vue";
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useGlobalState } from '../store'
import { CloudDownloadRound, ArrowBackIosNewFilled, ArrowForwardIosFilled, InboxRound } from '@vicons/material'
import { useIsMobile } from '../utils/composables'
import { processItem } from '../utils/email-parser'
import { utcToLocalDate } from '../utils';
import MailContentRenderer from "./MailContentRenderer.vue";
import AiExtractInfo from "./AiExtractInfo.vue";

const message = useMessage()
const isMobile = useIsMobile()

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
})

const localFilterKeyword = ref('')

const {
  isDark, mailboxSplitSize, indexTab, loading, useUTCDate,
  autoRefresh, configAutoRefreshInterval, sendMailModel
} = useGlobalState()
const autoRefreshInterval = ref(configAutoRefreshInterval.value)
const rawData = ref([])
const timer = ref(null)

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

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
    curMail.value = data.value[currentIndex - 1]
  } else if (page.value > 1) {
    page.value--
    await refresh()
    if (data.value.length > 0) {
      curMail.value = data.value[data.value.length - 1]
    }
  }
}

const nextMail = async () => {
  if (!canGoNextMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex < data.value.length - 1) {
    curMail.value = data.value[currentIndex + 1]
  } else if (count.value > page.value * pageSize.value) {
    page.value++
    await refresh()
    if (data.value.length > 0) {
      curMail.value = data.value[0]
    }
  }
}

const curMail = ref(null);

const multiActionMode = ref(false)
const showMultiActionDownload = ref(false)
const showMultiActionDelete = ref(false)
const multiActionDownloadZip = ref({})
const multiActionDeleteProgress = ref({ percentage: 0, tip: '0/0' })

const { t } = useI18n({
  messages: {
    en: {
      success: 'Success',
      autoRefresh: 'Auto Refresh',
      refreshAfter: 'Refresh After {msg} Seconds',
      refresh: 'Refresh',
      attachments: 'Show Attachments',
      downloadMail: 'Download Mail',
      pleaseSelectMail: "Please select mail",
      emptyInbox: "Your inbox is empty",
      delete: 'Delete',
      deleteMailTip: 'Are you sure you want to delete mail?',
      reply: 'Reply',
      forwardMail: 'Forward',
      showTextMail: 'Show Text Mail',
      showHtmlMail: 'Show Html Mail',
      saveToS3: 'Save to S3',
      multiAction: 'Multi Action',
      cancelMultiAction: 'Cancel Multi Action',
      selectAll: 'Select All of This Page',
      unselectAll: 'Unselect All',
      prevMail: 'Previous',
      nextMail: 'Next',
      keywordQueryTip: 'Filter current page',
      query: 'Query',
    },
    zh: {
      success: '成功',
      autoRefresh: '自动刷新',
      refreshAfter: '{msg}秒后刷新',
      refresh: '刷新',
      downloadMail: '下载邮件',
      attachments: '查看附件',
      pleaseSelectMail: "请选择邮件",
      emptyInbox: "收件箱为空",
      delete: '删除',
      deleteMailTip: '确定要删除邮件吗?',
      reply: '回复',
      forwardMail: '转发',
      showTextMail: '显示纯文本邮件',
      showHtmlMail: '显示HTML邮件',
      saveToS3: '保存到S3',
      multiAction: '多选',
      cancelMultiAction: '取消多选',
      selectAll: '全选本页',
      unselectAll: '取消全选',
      prevMail: '上一封',
      nextMail: '下一封',
      keywordQueryTip: '过滤当前页',
      query: '查询',
    }
  }
});

const setupAutoRefresh = async (autoRefresh) => {
  // auto refresh every configAutoRefreshInterval seconds
  autoRefreshInterval.value = configAutoRefreshInterval.value;
  if (autoRefresh) {
    clearInterval(timer.value);
    timer.value = setInterval(async () => {
      if (loading.value) return;
      autoRefreshInterval.value--;
      if (autoRefreshInterval.value <= 0) {
        autoRefreshInterval.value = configAutoRefreshInterval.value;
        await backFirstPageAndRefresh();
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

watch([page, pageSize], async ([page, pageSize], [oldPage, oldPageSize]) => {
  if (page !== oldPage || pageSize !== oldPageSize) {
    await refresh();
  }
})

const refresh = async () => {
  try {
    const { results, count: totalCount } = await props.fetchMailData(
      pageSize.value, (page.value - 1) * pageSize.value
    );
    loading.value = true;
    rawData.value = await Promise.all(results.map(async (item) => {
      item.checked = false;
      return await processItem(item);
    }));
    if (totalCount > 0) {
      count.value = totalCount;
    }
    curMail.value = null;
    if (!isMobile.value && data.value.length > 0) {
      curMail.value = data.value[0];
    }
  } catch (error) {
    message.error(error.message || "error");
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const backFirstPageAndRefresh = async () => {
  page.value = 1;
  await refresh();
}

const clickRow = async (row) => {
  if (multiActionMode.value) {
    row.checked = !row.checked;
    return;
  }
  curMail.value = row;
};


const mailItemClass = (row) => {
  return curMail.value && row.id == curMail.value.id ? (isDark.value ? 'overlay overlay-dark-backgroud' : 'overlay overlay-light-backgroud') : '';
};

const deleteMail = async () => {
  try {
    await props.deleteMail(curMail.value.id);
    message.success(t("success"));
    curMail.value = null;
    await refresh();
  } catch (error) {
    message.error(error.message || "error");
  }
};

const replyMail = async () => {
  const emailRegex = /(.+?) <(.+?)>/;
  let toMail = curMail.value.originalSource;
  let toName = ""
  const match = emailRegex.exec(curMail.value.source);
  if (match) {
    toName = match[1];
    toMail = match[2];
  }
  Object.assign(sendMailModel.value, {
    toName: toName,
    toMail: toMail,
    subject: `${t('reply')}: ${curMail.value.subject}`,
    contentType: 'rich',
    content: curMail.value.text ? `<p><br></p><blockquote>${curMail.value.text}</blockquote><p><br></p>` : '',
  });
  indexTab.value = 'sendmail';
};

const forwardMail = async () => {
  Object.assign(sendMailModel.value, {
    subject: `${t('forwardMail')}: ${curMail.value.subject}`,
    contentType: curMail.value.message ? 'html' : 'text',
    content: curMail.value.message || curMail.value.text,
  });
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
    for (const [index, mail] of selectedMails.entries()) {
      await props.deleteMail(mail.id);
      showMultiActionDelete.value = true;
      multiActionDeleteProgress.value = {
        percentage: Math.floor((index + 1) / selectedMails.length * 100),
        tip: `${index + 1}/${selectedMails.length}`
      };
    }
    message.success(t("success"));
    await refresh();
  } catch (error) {
    message.error(error.message || "error");
  } finally {
    loading.value = false;
    showMultiActionDelete.value = true;
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
  clearInterval(timer.value)
})
</script>

<template>
  <div>
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
              <n-button tertiary type="error">{{ t('delete') }}</n-button>
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
            :placeholder="t('keywordQueryTip')" style="width: 200px; display: flex; align-items: center;"
            clearable />
        </n-space>
      </div>
      <n-split class="left" direction="horizontal" :max="0.75" :min="0.25" :default-size="mailboxSplitSize"
        :on-update:size="onSpiltSizeChange">
        <template #1>
          <div style="overflow: auto; min-height: 60vh; max-height: 100vh;">
            <n-list hoverable clickable>
              <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)"
                :class="mailItemClass(row)">
                <template #prefix v-if="multiActionMode">
                  <n-checkbox v-model:checked="row.checked" />
                </template>
                <n-thing :title="row.subject">
                  <template #description>
                    <n-tag type="info">
                      ID: {{ row.id }}
                    </n-tag>
                    <n-tag type="info">
                      {{ utcToLocalDate(row.created_at, useUTCDate) }}
                    </n-tag>
                    <n-tag type="info">
                      <n-ellipsis style="max-width: 240px;">
                        {{ showEMailTo ? "FROM: " + row.source : row.source }}
                      </n-ellipsis>
                    </n-tag>
                    <n-tag v-if="showEMailTo" type="info">
                      <n-ellipsis style="max-width: 240px;">
                        TO: {{ row.address }}
                      </n-ellipsis>
                    </n-tag>
                    <AiExtractInfo :metadata="row.metadata" compact />
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </div>
        </template>
        <template #2>
          <div v-if="curMail" style="margin: 8px;">
            <n-flex justify="space-between">
              <n-button @click="prevMail" :disabled="!canGoPrevMail" text size="small">
                <template #icon>
                  <n-icon>
                    <ArrowBackIosNewFilled />
                  </n-icon>
                </template>
                {{ t('prevMail') }}
              </n-button>
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
          <n-card :bordered="false" embedded v-if="curMail" class="mail-item" :title="curMail.subject"
            style="overflow: auto; max-height: 100vh;">
            <MailContentRenderer :mail="curMail" :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail" :showReply="showReply" :showSaveS3="showSaveS3"
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
    </div>
    <div class="left" v-else>
      <n-space justify="space-around" align="center" :wrap="false" style="display: flex; align-items: center;">
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
          :placeholder="t('keywordQueryTip')" size="small" clearable />
      </div>
      <div style="overflow: auto; min-height: 60vh; max-height: 100vh;">
        <n-list hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)">
            <n-thing :title="row.subject">
              <template #description>
                <n-tag type="info">
                  ID: {{ row.id }}
                </n-tag>
                <n-tag type="info">
                  {{ utcToLocalDate(row.created_at, useUTCDate) }}
                </n-tag>
                <n-tag type="info">
                  <n-ellipsis style="max-width: 240px;">
                    {{ showEMailTo ? "FROM: " + row.source : row.source }}
                  </n-ellipsis>
                </n-tag>
                <n-tag v-if="showEMailTo" type="info">
                  <n-ellipsis style="max-width: 240px;">
                    TO: {{ row.address }}
                  </n-ellipsis>
                </n-tag>
                <AiExtractInfo :metadata="row.metadata" compact />
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </div>
      <n-drawer v-model:show="curMail" width="100%" placement="bottom" :trap-focus="false" :block-scroll="false"
        style="height: 80vh;">
        <n-drawer-content :title="curMail ? curMail.subject : ''" closable>
          <n-card :bordered="false" embedded style="overflow: auto;">
            <MailContentRenderer :mail="curMail" :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail" :showReply="showReply" :showSaveS3="showSaveS3"
              :useUTCDate="useUTCDate" :onDelete="deleteMail" :onReply="replyMail" :onForward="forwardMail"
              :onSaveToS3="saveToS3Proxy" />
          </n-card>
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
    <n-modal v-model:show="showMultiActionDelete" preset="dialog" :title="t('delete') + t('success')"
      negative-text="OK">
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

.overlay-dark-backgroud {
  background-color: rgba(255, 255, 255, 0.1);
}

.overlay-light-backgroud {
  background-color: rgba(0, 0, 0, 0.1);
}

.mail-item {
  height: 100%;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
