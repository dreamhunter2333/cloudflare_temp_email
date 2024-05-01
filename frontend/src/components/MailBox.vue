<script setup>
import { watch, onMounted, ref, onBeforeUnmount } from "vue";
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useGlobalState } from '../store'
import { CloudDownloadRound } from '@vicons/material'
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
})

const { themeSwitch, mailboxSplitSize, useIframeShowMail } = useGlobalState()
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

const { t } = useI18n({
  locale: 'zh',
  messages: {
    en: {
      success: 'Success',
      autoRefresh: 'Auto Refresh',
      refreshAfter: 'Refresh After {msg} Seconds',
      refresh: 'Refresh',
      attachments: 'Show Attachments',
      downloadMail: 'Download Mail',
      pleaseSelectMail: "Please select a mail to view.",
      delete: 'Delete',
      deleteMailTip: 'Are you sure you want to delete this mail?'
    },
    zh: {
      success: '成功',
      autoRefresh: '自动刷新',
      refreshAfter: '{msg}秒后刷新',
      refresh: '刷新',
      downloadMail: '下载邮件',
      attachments: '查看附件',
      pleaseSelectMail: "请选择一封邮件查看。",
      delete: '删除',
      deleteMailTip: '确定要删除这封邮件吗？'
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
    data.value = await Promise.all(results.map(async (item) => {
      return await processItem(item);
    }));
    if (totalCount > 0) {
      count.value = totalCount;
    }
    if (!isMobile.value && !curMail.value && data.value.length > 0) {
      curMail.value = data.value[0];
    }
  } catch (error) {
    message.error(error.message || "error");
    console.error(error);
  }
};

const clickRow = async (row) => {
  curMail.value = row;
};

const getAttachments = (attachments) => {
  curAttachments.value = attachments;
  showAttachments.value = true;
};

const mailItemClass = (row) => {
  return curMail.value && row.id == curMail.value.id ? (themeSwitch.value ? 'overlay overlay-dark-backgroud' : 'overlay overlay-light-backgroud') : '';
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

const onSpiltSizeChange = (size) => {
  mailboxSplitSize.value = size;
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
    <n-split class="left" v-if="!isMobile" direction="horizontal" :max="0.75" :min="0.25"
      :default-size="mailboxSplitSize" :on-update:size="onSpiltSizeChange">
      <template #1>
        <div class="center">
          <div style="display: inline-block; margin-top: 10px; margin-bottom: 10px;">
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
          <n-button @click="refresh" size="small" type="primary">
            {{ t('refresh') }}
          </n-button>
        </div>
        <div style="overflow: auto; height: 80vh;">
          <n-list hoverable clickable>
            <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)"
              :class="mailItemClass(row)">
              <n-thing :title="row.subject">
                <template #description>
                  <n-tag type="info">
                    ID: {{ row.id }}
                  </n-tag>
                  <n-tag type="info">
                    {{ row.created_at }}
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
        <n-card v-if="curMail" class="mail-item" :title="curMail.subject" style="overflow: auto; max-height: 100vh;">
          <n-space>
            <n-tag type="info">
              ID: {{ curMail.id }}
            </n-tag>
            <n-tag type="info">
              {{ curMail.created_at }}
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
              <n-icon :component="CloudDownloadRound" />
              {{ t('downloadMail') }}
            </n-button>
          </n-space>
          <iframe v-if="useIframeShowMail" :srcdoc="curMail.message"
            style="margin-top: 10px;width: 100%; height: 100%;">
          </iframe>
          <div v-else v-html="curMail.message" style="margin-top: 10px;"></div>
        </n-card>
        <n-card class="mail-item" v-else>
          <n-result status="info" :title="t('pleaseSelectMail')">
          </n-result>
        </n-card>
      </template>
    </n-split>
    <div class="left" v-else>
      <div class="center">
        <div style="display: inline-block; margin-top: 10px; margin-bottom: 10px;">
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple size="small" />
        </div>
        <n-switch v-model:value="autoRefresh" size="small">
          <template #checked>
            {{ t('autoRefresh') }}
          </template>
          <template #unchecked>
            {{ t('autoRefresh') }}
          </template></n-switch>
        <n-button @click="refresh" size="small" type="primary">
          {{ t('refresh') }}
        </n-button>
      </div>
      <div style="overflow: auto; height: 80vh;">
        <n-list hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)">
            <n-thing :title="row.subject">
              <template #description>
                <n-tag type="info">
                  ID: {{ row.id }}
                </n-tag>
                <n-tag type="info">
                  {{ row.created_at }}
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
          <n-card style="overflow: auto;">
            <n-space>
              <n-tag type="info">
                ID: {{ curMail.id }}
              </n-tag>
              <n-tag type="info">
                {{ curMail.created_at }}
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
            </n-space>
            <div v-html="curMail.message" style="margin-top: 10px;"></div>
          </n-card>
        </n-drawer-content>
      </n-drawer>
    </div>
    <n-modal v-model:show="showAttachments" preset="dialog" title="Dialog">
      <template #header>
        <div>{{ t("attachments") }}</div>
      </template>
      <n-list hoverable clickable>
        <n-list-item v-for="row in curAttachments" v-bind:key="row.id">
          <n-thing class="center" :title="row.filename">
            <template #description>
              <n-space>
                <n-tag type="info">
                  Size: {{ row.size }}
                </n-tag>
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
</style>
