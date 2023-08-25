<script setup>
import { NSpace, NAlert } from 'naive-ui'
import { NSpin, NButton, NLayout, NPopconfirm } from 'naive-ui'
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
const data = ref([])
const API_BASE = import.meta.env.VITE_API_BASE || "";

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
    const response = await fetch(`${API_BASE}/api/new_address`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
    });

    if (!response.ok) {
      message.error(
        `${response.status} ${await response.text()}` || "error",
      );
      throw new Error(`${response.status} ${await response.text()}` || "error");
    }
    let res = await response.json();
    jwt.value = res["jwt"];
  } catch (error) {
    jwt.value = "";
    message.error(error.message || "error");
    console.error(error);
  } finally {
    loading.value = false;
  }
  await refresh();
};

const getSettings = async (jwt) => {
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
  }
  let res = await response.json();
  address.value = res["address"];
  await refresh();
}

watch(jwt, async (jwt, old) => getSettings(jwt))

onMounted(async () => {
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
  <n-spin size="large" description="loading..." :show="loading">
    <n-layout>
      <n-alert :type='address ? "info" : "warning"' show-icon>
        <span v-if="address">
          Your email address is <b>{{ address }}</b>
          <n-button class="button-left" @click="copy" size="small" tertiary round type="primary">Copy</n-button>
        </span>
        <span v-else>
          Please click <b>Get New Email</b> button to get a new email address
        </span>
      </n-alert>
      <n-popconfirm @positive-click="newEmail" :show-icon="false">
        <template #trigger>
          <n-button class="center" tertiary round type="primary">
            Get New Email
          </n-button>
        </template>
        Get New Email?
      </n-popconfirm>
      <n-button class="center button-left" @click="refresh" round type="primary">
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

.button-left {
  margin-left: 10px;
}
</style>
