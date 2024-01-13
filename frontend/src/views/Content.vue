<script setup>
import { NSpace, NAlert, NSwitch, NCard, NInput, NInputGroupLabel } from 'naive-ui'
import { NButton, NLayout, NInputGroup, NModal, NSelect, NPagination } from 'naive-ui'
import { NList, NListItem, NThing, NTag, NIcon } from 'naive-ui'
import { watch, onMounted, ref } from "vue";
import useClipboard from 'vue-clipboard3'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useGlobalState } from '../store'
import { api } from '../api'
import { CloudDownloadRound } from '@vicons/material'

const { toClipboard } = useClipboard()
const message = useMessage()

const { jwt, settings, openSettings } = useGlobalState()
const autoRefresh = ref(false)
const data = ref([])
const timer = ref(null)
const showPassword = ref(false)
const showNewEmail = ref(false)
const emailName = ref("")
const emailDomain = ref("")

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const showAttachments = ref(false)
const curAttachments = ref([])

const { t } = useI18n({
  locale: 'zh',
  messages: {
    en: {
      yourAddress: 'Your email address is',
      pleaseGetNewEmail: 'Please click "Get New Email" button to get a new email address',
      getNewEmail: 'Get New Email',
      getNewEmailTip1: 'Please input the email you want to use.',
      getNewEmailTip2: 'Levaing it blank will generate a random email address.',
      cancel: 'Cancel',
      ok: 'OK',
      copy: 'Copy',
      showPassword: 'Show Password',
      autoRefresh: 'Auto Refresh',
      refresh: 'Refresh',
      password: 'Password',
      passwordTip: 'Please copy the password and you can use it to login to your email account.',
      attachments: 'Show Attachments',
    },
    zh: {
      yourAddress: '你的邮箱地址是',
      pleaseGetNewEmail: '请点击 "获取新邮箱" 按钮来获取一个新的邮箱地址',
      getNewEmail: '获取新邮箱',
      getNewEmailTip1: '请输入你想要使用的邮箱地址。',
      getNewEmailTip2: '留空将会生成一个随机的邮箱地址。',
      cancel: '取消',
      ok: '确定',
      copy: '复制',
      showPassword: '显示密码',
      autoRefresh: '自动刷新',
      refresh: '刷新',
      password: '密码',
      passwordTip: '请复制密码，你可以使用它登录你的邮箱。',
      attachments: '查看附件',
    }
  }
});

const setupAutoRefresh = async (autoRefresh) => {
  if (autoRefresh) {
    timer.value = setInterval(async () => {
      await refresh();
    }, 30000)
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
  if (typeof settings.value.address != 'string' || settings.value.address.trim() === '') {
    return;
  }
  try {
    const { results, count: totalCount } = await api.fetch(
      `/api/mails`
      + `?limit=${pageSize.value}`
      + `&offset=${(page.value - 1) * pageSize.value}`
    );
    data.value = results;
    if (totalCount > 0) {
      count.value = totalCount;
    }
  } catch (error) {
    message.error(error.message || "error");
    console.error(error);
  }
};

const copy = async () => {
  try {
    await toClipboard(settings.value.address)
    message.success('Copied');
  } catch (e) {
    message.error(e.message || "error");
  }
}

const newEmail = async () => {
  try {
    const res = await api.fetch(
      `/api/new_address`
      + `?name=${emailName.value || ''}`
      + `&domain=${emailDomain.value || ''}`
    );
    jwt.value = res["jwt"];
    await api.getSettings();
    await refresh();
    showNewEmail.value = false;
    showPassword.value = true;
  } catch (error) {
    message.error(error.message || "error");
  }
};

const getAttachments = async (attachment_id) => {
  try {
    const res = await api.fetch(
      `/api/attachment/${attachment_id}`
    );
    curAttachments.value = res
      .filter((item) => item?.content?.data)
      .map((item) => {
        return {
          id: item.contentId || Math.random().toString(36).substring(2, 15),
          filename: item.filename || "",
          size: item.size,
          url: URL.createObjectURL(
            new Blob(
              [new Uint8Array(item.content.data)],
              { type: item.contentType || 'application/octet-stream' }
            ))
        }
      });
    showAttachments.value = true;
  } catch (error) {
    message.error(error.message || "error");
  }
};

onMounted(async () => {
  await api.getOpenSettings(message);
  emailDomain.value = openSettings.value.domains ? openSettings.value.domains[0].value : "";
  await api.getSettings();
  await refresh();
});
</script>

<template>
  <div>
    <n-layout>
      <n-alert :type='settings.address ? "info" : "warning"' show-icon>
        <span v-if="settings.address">
          {{ t('yourAddress') }} <b>{{ settings.address }}</b>
          <n-button @click="copy" size="small" tertiary round type="primary">
            {{ t('copy') }}
          </n-button>
        </span>
        <span v-else>
          {{ t('pleaseGetNewEmail') }}
        </span>
      </n-alert>
      <n-button v-if="settings.address" class="center" @click="showPassword = true" tertiary round type="primary">
        {{ t('showPassword') }}
      </n-button>
      <n-button v-else class="center" @click="showNewEmail = true" tertiary round type="primary">
        {{ t('getNewEmail') }}
      </n-button>
      <n-switch v-model:value="autoRefresh">
        <template #checked>
          {{ t('autoRefresh') }}
        </template>
        <template #unchecked>
          {{ t('autoRefresh') }}
        </template></n-switch>
      <n-button class="center" @click="refresh" round type="primary">
        {{ t('refresh') }}
      </n-button>
      <div>
        <div style="display: inline-block; margin-top: 10px; margin-bottom: 10px;">
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple />
        </div>
      </div>
      <n-list hoverable clickable>
        <n-list-item v-for="row in data" v-bind:key="row.id">
          <n-thing class="center" :title="row.subject">
            <template #description>
              <n-space>
                <n-tag type="info">
                  FROM: {{ row.source }}
                </n-tag>
                <n-tag type="info">
                  ID: {{ row.id }}
                </n-tag>
                <n-button v-if="row.attachment_id" size="small" tertiary type="info"
                  @click="getAttachments(row.attachment_id)">
                  {{ t('attachments') }}
                </n-button>
              </n-space>
            </template>
            <div v-html="row.message"></div>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-layout>
    <n-modal v-model:show="showNewEmail" preset="dialog" title="Dialog">
      <template #header>
        <div>{{ t('getNewEmail') }}</div>
      </template>
      <span>
        <p>{{ t("getNewEmailTip1") }}</p>
        <p>{{ t("getNewEmailTip2") }}</p>
      </span>
      <n-input-group>
        <n-input-group-label v-if="openSettings.prefix">
          {{ openSettings.prefix }}
        </n-input-group-label>
        <n-input v-model:value="emailName" />
        <n-input-group-label>@</n-input-group-label>
        <n-select v-model:value="emailDomain" :consistent-menu-width="false" :options="openSettings.domains" />
      </n-input-group>
      <template #action>
        <n-button @click="showNewEmail = false">
          {{ t('cancel') }}
        </n-button>
        <n-button @click="newEmail" type="primary">
          {{ t('ok') }}
        </n-button>
      </template>
    </n-modal>
    <n-modal v-model:show="showPassword" preset="dialog" title="Dialog">
      <template #header>
        <div>{{ t("password") }}</div>
      </template>
      <span>
        <p>{{ t("passwordTip") }}</p>
      </span>
      <n-card>
        <b>{{ jwt }}</b>
      </n-card>
      <template #action>
      </template>
    </n-modal>
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
            <n-button tag="a" target="_blank" tertiary type="info" size="small'" :download="row.filename" :href="row.url">
              <n-icon :component="CloudDownloadRound" />
            </n-button>
          </template>
        </n-list-item>
      </n-list>
      <template #action>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.n-alert {
  margin-bottom: 10px;
  text-align: center;
}
</style>
