<script setup>
import { NGrid, NGi, NSpace, NAlert, NMessageProvider } from 'naive-ui'
import { NSpin, NButton, NCard, NLayout, NPopconfirm } from 'naive-ui'
import { onMounted, ref } from "vue";
import { useStorage } from '@vueuse/core'

const address = useStorage('address')
const result = ref("")
const loading = ref(false)
const data = ref([])
const API_BASE = import.meta.env.VITE_API_BASE || "";

const refresh = async () => {
  if (typeof address.value != 'string' || address.value.trim() === '') {
    return;
  }
  try {
    loading.value = true;
    const response = await fetch(`${API_BASE}/api/mails?address=${address.value}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}` || "error");
    }
    let res = await response.json();
    data.value = res;
    result.value = "";
  } catch (error) {
    console.error(error);
    result.value = error.message || "error";
  } finally {
    loading.value = false;
  }
};

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
      throw new Error(`${response.status} ${await response.text()}` || "error");
    }
    let res = await response.json();
    address.value = res["address"];
  } catch (error) {
    address.value = "";
    console.error(error);
    result.value = error.message || "error";
  } finally {
    loading.value = false;
  }
  await refresh();
};

onMounted(async () => {
  await refresh();
  const token = import.meta.env.VITE_CF_WEB_ANALY_TOKEN;

  if (token) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.dataset.cfBeacon = `{ token: ${token} }`;
    document.body.appendChild(script);
  }

});
</script>

<template>
  <n-message-provider>
    <n-spin size="large" description="loading..." :show="loading">
      <n-grid x-gap="12" :cols="6">
        <n-gi span="6">
          <div class="main">
            <n-space vertical>
              <h2>Temp Email</h2>
              <n-layout>
                <n-layout>
                  <n-card>
                    <n-alert type="info" show-icon>
                      <span v-if="address">
                        Your email address is <b>{{ address }}</b>
                      </span>
                      <span v-else>
                        Please click <b>Get New Email</b> button to get a new email address
                      </span>
                    </n-alert>
                  </n-card>
                  <n-popconfirm @positive-click="newEmail" :show-icon="false">
                    <template #trigger>
                      <n-button class="center" tertiary round type="primary">
                        Get New Email
                      </n-button>
                    </template>
                    Get New Email?
                  </n-popconfirm>
                  <n-button class="center" @click="refresh" tertiary round type="primary">
                    Refresh
                  </n-button>
                  <n-card>
                    <n-alert type="" show-icon v-if="result">
                      <span>
                        <pre>{{ result }}</pre>
                      </span>
                    </n-alert>
                    <n-alert v-for="row in data" v-bind:key="row.id" :title="`EMAIL ID: ${row.id}`" type="default">
                      <div v-html="row.message"></div>
                    </n-alert>
                  </n-card>
                </n-layout>
              </n-layout>
            </n-space>
          </div>
        </n-gi>
      </n-grid>
    </n-spin>
  </n-message-provider>
</template>

<style scoped>
.side {
  height: 100vh;
}

.main {
  height: 100vh;
  text-align: center;
}

.n-grid {
  height: 100%;
}

.n-gi {
  height: 100%;
}

.n-space {
  height: 100%;
}

.n-alert {
  text-align: center;
}
</style>
