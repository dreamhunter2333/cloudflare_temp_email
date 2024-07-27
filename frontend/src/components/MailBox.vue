<script setup>
import { watch, onMounted, ref, onBeforeUnmount } from "vue";
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useGlobalState } from '../store'
import { CloudDownloadRound, ReplyFilled } from '@vicons/material'
import { useIsMobile } from '../utils/composables'
import { processItem, getDownloadEmlUrl } from '../utils/email-parser'

const message = useMessage()
const isMobile = useIsMobile()

const props = defineProps({
  enableUserDeleteEmail: {
    type: Boolean,
    default: false,
    requried: false
  },
  showEMailTo: {
    type: Boolean,
    default: true,
    requried: false
  },
  fetchMailData: {
    type: Function,
    default: () => { },
    requried: true
  },
  deleteMail: {
    type: Function,
    default: () => { },
    requried: false
  },
  showReply: {
    type: Boolean,
    default: false,
    requried: false
  },
  showSaveS3: {
    type: Boolean,
    default: false,
    requried: false
  },
  saveToS3: {
    type: Function,
    default: (mail_id, filename, blob) => { },
    requried: false
  },
})

const {
  isDark, mailboxSplitSize, indexTab, loading,
  useIframeShowMail, sendMailModel, preferShowTextMail
} = useGlobalState()
const autoRefresh = ref(false)
const autoRefreshInterval = ref(30)
const data = ref([])
const timer = ref(null)

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const showAttachments = ref(false)
const curAttachments = ref([])
const curMail = ref(null);
const showTextMail = ref(preferShowTextMail.value)

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
      delete: 'Delete',
      deleteMailTip: 'Are you sure you want to delete mail?',
      reply: 'Reply',
      showTextMail: 'Show Text Mail',
      showHtmlMail: 'Show Html Mail',
      saveToS3: 'Save to S3',
      multiAction: 'Multi Action',
      cancelMultiAction: 'Cancel Multi Action',
      selectAll: 'Select All of This Page',
      unselectAll: 'Unselect All',
    },
    zh: {
      success: '成功',
      autoRefresh: '自动刷新',
      refreshAfter: '{msg}秒后刷新',
      refresh: '刷新',
      downloadMail: '下载邮件',
      attachments: '查看附件',
      pleaseSelectMail: "请选择邮件",
      delete: '删除',
      deleteMailTip: '确定要删除邮件吗?',
      reply: '回复',
      showTextMail: '显示纯文本邮件',
      showHtmlMail: '显示HTML邮件',
      saveToS3: '保存到S3',
      multiAction: '多选',
      cancelMultiAction: '取消多选',
      selectAll: '全选本页',
      unselectAll: '取消全选',
    }
  }
});

const setupAutoRefresh = async (autoRefresh) => {
  // auto refresh every 30 seconds
  autoRefreshInterval.value = 30;
  if (autoRefresh) {
    timer.value = setInterval(async () => {
      autoRefreshInterval.value--;
      if (autoRefreshInterval.value <= 0) {
        autoRefreshInterval.value = 30;
        await refresh();
      }
    }, 1000)
  } else {
    clearInterval(timer.value)
    timer.value = null
  }
}

watch(autoRefresh, async (autoRefresh, old) => {
  setupAutoRefresh(autoRefresh)
})

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
    data.value = await Promise.all(results.map(async (item) => {
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

const clickRow = async (row) => {
  if (multiActionMode.value) {
    row.checked = !row.checked;
    return;
  }
  curMail.value = row;
};

const getAttachments = (attachments) => {
  curAttachments.value = attachments;
  showAttachments.value = true;
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

const onSpiltSizeChange = (size) => {
  mailboxSplitSize.value = size;
}

const attachmentLoding = ref(false)
const saveToS3Proxy = async (filename, blob) => {
  attachmentLoding.value = true
  try {
    await props.saveToS3(curMail.value.id, filename, blob);
  } finally {
    attachmentLoding.value = false
  }
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
        <n-space v-if="multiActionMode">
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
        <n-space v-else>
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
          <n-button @click="refresh" type="primary" tertiary>
            {{ t('refresh') }}
          </n-button>
        </n-space>
      </div>
      <n-split class="left" direction="horizontal" :max="0.75" :min="0.25" :default-size="mailboxSplitSize"
        :on-update:size="onSpiltSizeChange">
        <template #1>
          <div style="overflow: auto; height: 80vh;">
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
                      {{ `${row.created_at} UTC` }}
                    </n-tag>
                    <n-tag type="info">
                      FROM: {{ row.source }}
                    </n-tag>
                    <n-tag v-if="showEMailTo" type="info">
                      TO: {{ row.address }}
                    </n-tag>
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </div>
        </template>
        <template #2>
          <n-card :bordered="false" embedded v-if="curMail" class="mail-item" :title="curMail.subject"
            style="overflow: auto; max-height: 100vh;">
            <n-space>
              <n-tag type="info">
                ID: {{ curMail.id }}
              </n-tag>
              <n-tag type="info">
                {{ `${curMail.created_at} UTC` }}
              </n-tag>
              <n-tag type="info">
                FROM: {{ curMail.source }}
              </n-tag>
              <n-tag v-if="showEMailTo" type="info">
                TO: {{ curMail.address }}
              </n-tag>
              <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="deleteMail">
                <template #trigger>
                  <n-button tertiary type="error" size="small">{{ t('delete') }}</n-button>
                </template>
                {{ t('deleteMailTip') }}
              </n-popconfirm>
              <n-button v-if="curMail.attachments && curMail.attachments.length > 0" size="small" tertiary type="info"
                @click="getAttachments(curMail.attachments)">
                {{ t('attachments') }}
              </n-button>
              <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="curMail.id + '.eml'"
                :href="getDownloadEmlUrl(curMail.raw)">
                <template #icon>
                  <n-icon :component="CloudDownloadRound" />
                </template>
                {{ t('downloadMail') }}
              </n-button>
              <n-button v-if="showReply" size="small" tertiary type="info" @click="replyMail">
                <template #icon>
                  <n-icon :component="ReplyFilled" />
                </template>
                {{ t('reply') }}
              </n-button>
              <n-button size="small" tertiary type="info" @click="showTextMail = !showTextMail">
                {{ showTextMail ? t('showHtmlMail') : t('showTextMail') }}
              </n-button>
            </n-space>
            <pre v-if="showTextMail" style="margin-top: 10px;">{{ curMail.text }}</pre>
            <iframe v-else-if="useIframeShowMail" :srcdoc="curMail.message"
              style="margin-top: 10px;width: 100%; height: 100%;">
            </iframe>
            <div v-else v-html="curMail.message" style="margin-top: 10px;"></div>
          </n-card>
          <n-card :bordered="false" embedded class="mail-item" v-else>
            <n-result status="info" :title="t('pleaseSelectMail')">
            </n-result>
          </n-card>
        </template>
      </n-split>
    </div>
    <div class="left" v-else>
      <n-space justify="center">
        <div style="display: inline-block;">
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple size="small" />
        </div>
        <n-switch v-model:value="autoRefresh" size="small" :round="false">
          <template #checked>
            {{ t('refreshAfter', { msg: autoRefreshInterval }) }}
          </template>
          <template #unchecked>
            {{ t('autoRefresh') }}
          </template>
        </n-switch>
        <n-button @click="refresh" tertiary size="small" type="primary">
          {{ t('refresh') }}
        </n-button>
      </n-space>
      <div style="overflow: auto; height: 80vh;">
        <n-list hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)">
            <n-thing :title="row.subject">
              <template #description>
                <n-tag type="info">
                  ID: {{ row.id }}
                </n-tag>
                <n-tag type="info">
                  {{ `${row.created_at} UTC` }}
                </n-tag>
                <n-tag type="info">
                  FROM: {{ row.source }}
                </n-tag>
                <n-tag v-if="showEMailTo" type="info">
                  TO: {{ row.address }}
                </n-tag>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </div>
      <n-drawer v-model:show="curMail" width="100%" placement="bottom" :trap-focus="false" :block-scroll="false"
        style="height: 80vh;">
        <n-drawer-content :title="curMail ? curMail.subject : ''" closable>
          <n-card :bordered="false" embedded style="overflow: auto;">
            <n-space>
              <n-tag type="info">
                ID: {{ curMail.id }}
              </n-tag>
              <n-tag type="info">
                {{ `${curMail.created_at} UTC` }}
              </n-tag>
              <n-tag type="info">
                FROM: {{ curMail.source }}
              </n-tag>
              <n-tag v-if="showEMailTo" type="info">
                TO: {{ curMail.address }}
              </n-tag>
              <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="deleteMail">
                <template #trigger>
                  <n-button tertiary type="error" size="small">{{ t('delete') }}</n-button>
                </template>
                {{ t('deleteMailTip') }}
              </n-popconfirm>
              <n-button v-if="curMail.attachments && curMail.attachments.length > 0" size="small" tertiary type="info"
                @click="getAttachments(curMail.attachments)">
                {{ t('attachments') }}
              </n-button>
              <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="curMail.id + '.eml'"
                :href="getDownloadEmlUrl(curMail)">
                <n-icon :component="CloudDownloadRound" />
                {{ t('downloadMail') }}
              </n-button>
              <n-button v-if="showReply" size="small" tertiary type="info" @click="replyMail">
                <template #icon>
                  <n-icon :component="ReplyFilled" />
                </template>
                {{ t('reply') }}
              </n-button>
              <n-button size="small" tertiary type="info" @click="showTextMail = !showTextMail">
                {{ showTextMail ? t('showHtmlMail') : t('showTextMail') }}
              </n-button>
            </n-space>
            <pre v-if="showTextMail" style="margin-top: 10px;">{{ curMail.text }}</pre>
            <iframe v-else-if="useIframeShowMail" :srcdoc="curMail.message"
              style="margin-top: 10px;width: 100%; height: 100%;">
            </iframe>
            <div v-else v-html="curMail.message" style="margin-top: 10px;"></div>
          </n-card>
        </n-drawer-content>
      </n-drawer>
    </div>
    <n-modal v-model:show="showAttachments" preset="dialog" title="Dialog">
      <template #header>
        <div>{{ t("attachments") }}</div>
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
                  <n-button v-if="showSaveS3" @click="saveToS3Proxy(row.filename, row.blob)" ghost type="info"
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
