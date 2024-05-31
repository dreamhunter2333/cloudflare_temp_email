<script setup>
import { watch, onMounted, ref } from "vue";
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useGlobalState } from '../store'
import { useIsMobile } from '../utils/composables'

const message = useMessage()
const isMobile = useIsMobile()

const props = defineProps({
  showEMailFrom: {
    type: Boolean,
    default: false
  },
  fetchMailData: {
    type: Function,
    default: () => { },
    requried: true
  },
})

const { isDark, mailboxSplitSize } = useGlobalState()
const data = ref([])

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const curMail = ref(null);
const showCode = ref(false)

const { t } = useI18n({
  messages: {
    en: {
      success: 'Success',
      refresh: 'Refresh',
      showCode: 'Change View Original Code',
      pleaseSelectMail: "Please select a mail to view."
    },
    zh: {
      success: '成功',
      refresh: '刷新',
      showCode: '切换查看元数据',
      pleaseSelectMail: "请选择一封邮件查看。",
    }
  }
});

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
    data.value = results.map((item) => {
      try {
        const data = JSON.parse(item.raw);
        if (data.version == "v2") {
          item.to_mail = data.to_name ? `${data.to_name} <${data.to_mail}>` : data.to_mail;
          item.subject = data.subject;
          item.is_html = data.is_html;
          item.content = data.content;
          item.raw = JSON.stringify(data, null, 2);
        } else {
          item.to_mail = data?.personalizations?.map(
            (p) => p.to?.map((t) => t.email).join(',')
          ).join(';');
          item.subject = data.subject;
          item.is_html = (data.content[0]?.type != 'text/plain');
          item.content = data.content[0]?.value;
          item.raw = JSON.stringify(data, null, 2);
        }
      } catch (error) {
        console.log(error);
      }
      return item;
    });
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

const mailItemClass = (row) => {
  return curMail.value && row.id == curMail.value.id ? (isDark.value ? 'overlay overlay-dark-backgroud' : 'overlay overlay-light-backgroud') : '';
};

const onSpiltSizeChange = (size) => {
  mailboxSplitSize.value = size;
}

onMounted(async () => {
  await refresh();
});
</script>

<template>
  <div>
    <n-split class="left" v-if="!isMobile" direction="horizontal" :max="0.75" :min="0.25"
      :default-size="mailboxSplitSize" :on-update:size="onSpiltSizeChange">
      <template #1>
        <div class="center">
          <div style="display: inline-block; margin-right: 10px;">
            <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple size="small" />
          </div>
          <n-button @click="refresh" size="small" type="primary" tertiary>
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
                    {{ `${row.created_at} UTC` }}
                  </n-tag>
                  <n-tag v-if="showEMailFrom" type="info">
                    FROM: {{ row.address }}
                  </n-tag>
                  <n-tag type="info">
                    TO: {{ row.to_mail }}
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
              {{ `${curMail.created_at} UTC` }}
            </n-tag>
            <n-tag type="info">
              FROM: {{ curMail.address }}
            </n-tag>
            <n-tag type="info">
              TO: {{ curMail.to_mail }}
            </n-tag>
            <n-button size="small" tertiary type="info" @click="showCode = !showCode">
              {{ t('showCode') }}
            </n-button>
          </n-space>
          <pre v-if="showCode" style="margin-top: 10px;">{{ curMail.raw }}</pre>
          <pre v-else-if="!curMail.is_html" style="margin-top: 10px;">{{ curMail.content }}</pre>
          <div v-else v-html="curMail.content" style="margin-top: 10px;"></div>
        </n-card>
        <n-card class="mail-item" v-else>
          <n-result status="info" :title="t('pleaseSelectMail')">
          </n-result>
        </n-card>
      </template>
    </n-split>
    <div class="left" v-else>
      <div class="center">
        <div style="display: inline-block; margin-right: 10px;">
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple size="small" />
        </div>
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
                  {{ `${row.created_at} UTC` }}
                </n-tag>
                <n-tag v-if="showEMailFrom" type="info">
                  FROM: {{ row.address }}
                </n-tag>
                <n-tag type="info">
                  TO: {{ row.to_mail }}
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
                {{ `${curMail.created_at} UTC` }}
              </n-tag>
              <n-tag type="info">
                FROM: {{ curMail.address }}
              </n-tag>
              <n-tag type="info">
                TO: {{ curMail.to_mail }}
              </n-tag>
            </n-space>
            <pre v-if="showCode" style="margin-top: 10px;">{{ curMail.raw }}</pre>
            <pre v-else-if="!curMail.is_html" style="margin-top: 10px;">{{ curMail.content }}</pre>
            <div v-else v-html="curMail.content" style="margin-top: 10px;"></div>
          </n-card>
        </n-drawer-content>
      </n-drawer>
    </div>
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
