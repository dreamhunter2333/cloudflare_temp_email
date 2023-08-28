<script setup>
import { NMessageProvider, NGrid, NBackTop, NLayoutHeader } from 'naive-ui'
import { NGi, NSpace, NButton, NConfigProvider, NSelect } from 'naive-ui'
import { darkTheme, NSwitch, NGlobalStyle } from 'naive-ui'
import { computed, ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { zhCN } from 'naive-ui'

import Content from './Content.vue'

const themeSwitch = useStorage('themeSwitch', false)
const localeCache = useStorage('localeCache', false)
const theme = computed(() => themeSwitch.value ? darkTheme : null)
const locale = computed(() => localeCache.value ? zhCN : null)
</script>

<template>
  <n-config-provider :theme="theme">
    <n-global-style />
    <n-message-provider>
      <n-grid x-gap="12" :cols="8">
        <n-gi span="1"></n-gi>
        <n-gi span="6">
          <div class="main">
            <n-space vertical>
              <n-layout-header>
                <div>
                  <h2>Cloudflare Temp Email </h2>
                </div>
                <div>
                  <n-switch v-model:value="themeSwitch">
                    <template #checked>
                      Dark
                    </template>
                    <template #unchecked>
                      Light
                    </template>
                  </n-switch>
                  <n-button tag="a" target="_blank" tertiary type="primary" round
                    href="https://github.com/dreamhunter2333/cloudflare_temp_email">Star on Github
                  </n-button>
                </div>
              </n-layout-header>
              <Content />
            </n-space>
          </div>
        </n-gi>
        <n-gi span="1"></n-gi>
      </n-grid>
      <n-back-top :right="100" />
    </n-message-provider>
  </n-config-provider>
</template>


<style>
.n-button {
  margin-left: 10px;
  margin-right: 10px;
}

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

.n-layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
