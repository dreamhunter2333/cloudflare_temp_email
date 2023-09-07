<script setup>
import { NSpace, NAlert, NSwitch, NCard, NInput, NInputGroupLabel } from 'naive-ui'
import { NSpin, NButton, NLayout, NInputGroup, NModal, NSelect } from 'naive-ui'
import { NList, NListItem, NThing, NTag, NNumberAnimation } from 'naive-ui'
import { watch, onMounted, ref } from "vue";
import { useStorage } from '@vueuse/core'
import useClipboard from 'vue-clipboard3'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { toClipboard } = useClipboard()
const message = useMessage()

const jwt = useStorage('jwt')
const address = ref("")
const loading = ref(false)
const autoRefresh = ref(false)
const data = ref([])
const API_BASE = import.meta.env.VITE_API_BASE || "";
const timer = ref(null)
const showPassword = ref(false)
const showNewEmail = ref(false)
const emailName = ref("")
const emailDomain = ref("")
const openSettings = ref({
  prefix: 'test',
  domains: [{
    label: 'test.com',
    value: 'test.com'
  }]
})

const { t, locale } = useI18n({
  useScope: 'global',
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

const refresh = async () => {
  if (typeof address.value != 'string' || address.value.trim() === '') {
    return;
  }
  try {
    loading.value = true;
    const response = await fetch(`${API_BASE}/api/mails`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jwt.value}`,
        "Content-Type": "application/json"
      },
    });

    if (!response.ok) {
      message.error(`${response.status} ${await response.text()}` || "error");
      throw new Error(`${response.status} ${await response.text()}` || "error");
    }
    let res = await response.json();
    data.value = res;
  } catch (error) {
    message.error(error.message || "error");
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const copy = async () => {
  try {
    await toClipboard(address.value)
    message.success('Copied');
  } catch (e) {
    message.error(e.message || "error");
  }
}

const newEmail = async () => {
  try {
    loading.value = true;
    let url = `${API_BASE}/api/new_address`;
    url = `${url}?name=${emailName.value || ''}`;
    url = `${url}&domain=${emailDomain.value || ''}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}` || "error");
    }
    let res = await response.json();
    jwt.value = res["jwt"];
    await refresh();
    showNewEmail.value = false;
    showPassword.value = true;
  } catch (error) {
    message.error(error.message || "error");
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const getOpenSettings = async (jwt) => {
  const response = await fetch(`${API_BASE}/open_api/settings`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
  });

  if (!response.ok) {
    message.error(`${response.status} ${await response.text()}` || "error");
    console.error(response);
    return;
  }
  let res = await response.json();
  openSettings.value = {
    prefix: res["prefix"] || "",
    domains: res["domains"].map((domain) => {
      return {
        label: domain,
        value: domain
      }
    })
  };
  emailDomain.value = openSettings.value.domains[0].value;
}

const getSettings = async (jwt) => {
  if (typeof jwt != 'string' || jwt.trim() === '' || jwt === 'undefined') {
    return;
  }
  const response = await fetch(`${API_BASE}/api/settings`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json"
    },
  });

  if (!response.ok) {
    message.error(`${response.status} ${await response.text()}` || "error");
    console.error(response);
    address.value = "";
    return;
  }
  let res = await response.json();
  address.value = res["address"];
  await refresh();
}

watch(jwt, async (jwt, old) => getSettings(jwt))

onMounted(async () => {
  getOpenSettings()
  getSettings(jwt.value)
  await refresh();
  const token = import.meta.env.VITE_CF_WEB_ANALY_TOKEN;

  const exist = document.querySelector('script[src="https://static.cloudflareinsights.com/beacon.min.js"]') !== null
  if (token && !exist) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.dataset.cfBeacon = `{ token: ${token} }`;
    document.body.appendChild(script);
  }

});
</script>

<template>
  <n-spin description="loading..." :show="loading">
    <n-layout>
      <n-alert :type='address ? "info" : "warning"' show-icon>
        <span v-if="address">
          {{ t('yourAddress') }} <b>{{ address }}</b>
          <n-button @click="copy" size="small" tertiary round type="primary">
            {{ t('copy') }}
          </n-button>
        </span>
        <span v-else>
          {{ t('pleaseGetNewEmail') }}
        </span>
      </n-alert>
      <n-button v-if="address" class="center" @click="showPassword = true" tertiary round type="primary">
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
  </n-spin>
</template>

<style scoped>
.n-alert {
  margin-bottom: 10px;
  text-align: center;
}

.n-list {
  margin-top: 10px;
  text-align: center;
}
</style>
