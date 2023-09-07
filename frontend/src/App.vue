<script setup>
import { NMessageProvider, NGrid, NBackTop, NLayoutHeader, NInput } from 'naive-ui'
import { NGi, NSpace, NButton, NConfigProvider, NSelect, NModal } from 'naive-ui'
import { darkTheme, NSwitch, NGlobalStyle, NPopconfirm } from 'naive-ui'
import { computed, ref } from 'vue'
import { useStorage } from '@vueuse/core'

import Content from './Content.vue'

const jwt = useStorage('jwt')
const themeSwitch = useStorage('themeSwitch', false)
const theme = computed(() => themeSwitch.value ? darkTheme : null)
const showLogin = ref(false)
const password = ref('')

const login = () => {
  jwt.value = password.value;
  location.reload()
}
const logout = () => {
  jwt.value = '';
  location.reload()
}
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
                  <n-popconfirm v-if="jwt" @positive-click="logout">
                    <template #trigger>
                      <n-button tertiary round type="primary">
                        Logout
                      </n-button>
                    </template>
                    <template #default>
                      <span>Are you sure to logout?</span>
                    </template>
                  </n-popconfirm>
                  <n-button v-else tertiary @click="showLogin = true" round type="primary">
                    Login
                  </n-button>
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
      <n-modal v-model:show="showLogin" preset="dialog" title="Dialog">
        <template #header>
          <div>Login</div>
        </template>
        <n-input v-model:value="password" type="textarea" :autosize="{
          minRows: 3
        }" />
        <template #action>
          <n-button @click="login" size="small" tertiary round type="primary">
            Login
          </n-button>
        </template>
      </n-modal>
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
