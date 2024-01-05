<script setup>
import { NMessageProvider, NGrid, NBackTop, NSpin } from 'naive-ui'
import { NGi, NSpace, NButton, NConfigProvider } from 'naive-ui'
import { darkTheme, NGlobalStyle } from 'naive-ui'
import { zhCN } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIsMobile } from './utils/composables'

import Content from './views/Content.vue'
import Header from './views/Header.vue'
import { useGlobalState } from './store'

const { localeCache, themeSwitch, loading } = useGlobalState()
const theme = computed(() => themeSwitch.value ? darkTheme : null)
const localeConfig = computed(() => localeCache.value == 'zh' ? zhCN : null)
const isMobile = useIsMobile()

const { locale } = useI18n({
  useScope: 'global',
});
locale.value = localeCache.value;

onMounted(async () => {
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
  <n-config-provider :locale="localeConfig" :theme="theme">
    <n-global-style />
    <n-spin description="loading..." :show="loading">
      <n-message-provider>
        <n-grid x-gap="12" :cols="12">
          <n-gi v-if="!isMobile" span="1"></n-gi>
          <n-gi :span="isMobile ? 12 : 10">
            <div class="main">
              <router-view></router-view>
            </div>
          </n-gi>
          <n-gi v-if="!isMobile" span="1"></n-gi>
        </n-grid>
        <n-back-top :right="100" />
      </n-message-provider>
    </n-spin>
  </n-config-provider>
</template>


<style>
.n-switch {
  margin-left: 10px;
  margin-right: 10px;
}
</style>

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
</style>
