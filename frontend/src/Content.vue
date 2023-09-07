<script setup>
import { NSpace, NAlert, NSwitch, NCard, NInput, NInputGroupLabel } from 'naive-ui'
import { NSpin, NButton, NLayout, NInputGroup, NModal } from 'naive-ui'
import { NList, NListItem, NThing, NTag, NNumberAnimation } from 'naive-ui'
import { watch, onMounted, ref } from "vue";
import { useStorage } from '@vueuse/core'
import useClipboard from 'vue-clipboard3'
import { useMessage } from 'naive-ui'

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
const openSettings = ref({
  prefix: 'test',
  domain: 'test.com'
})

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
    if (emailName.value) {
      url = `${url}?name=${emailName.value}`;
    }
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
  openSettings.value = res;
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
          Your email address is <b>{{ address }}</b>
          <n-button @click="copy" size="small" tertiary round type="primary">
            Copy
          </n-button>
        </span>
        <span v-else>
          Please click <b>Get New Email</b> button to get a new email address
        </span>
      </n-alert>
      <n-button v-if="address" class="center" @click="showPassword = true" tertiary round type="primary">
        Show Password
      </n-button>
      <n-button v-else class="center" @click="showNewEmail = true" tertiary round type="primary">
        Get New Email
      </n-button>
      <n-switch v-model:value="autoRefresh">
        <template #checked>
          Auto Refresh
        </template>
        <template #unchecked>
          Auto Refresh
        </template></n-switch>
      <n-button class="center" @click="refresh" round type="primary">
        Refresh
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
        <div>Get New Email</div>
      </template>
      <span>
        <p>Please input the email you want to use.</p>
        <p>Levaing it blank will generate a random email address.</p>
      </span>
      <n-input-group>
        <n-input-group-label v-if="openSettings.prefix">
          {{ openSettings.prefix }}
        </n-input-group-label>
        <n-input v-model:value="emailName" />
        <n-input-group-label>
          @{{ openSettings.domain }}
        </n-input-group-label>
      </n-input-group>
      <template #action>
        <n-button @click="showNewEmail = false">
          Cancel
        </n-button>
        <n-button @click="newEmail" type="primary">
          OK
        </n-button>
      </template>
    </n-modal>
    <n-modal v-model:show="showPassword" preset="dialog" title="Dialog">
      <template #header>
        <div>Password</div>
      </template>
      <span>
        Please copy the password and you can use it to login to your email account.
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
