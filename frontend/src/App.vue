<script setup>
import { NMessageProvider, NGrid, NGi, NSpace, NButton } from 'naive-ui'
import Content from './Content.vue';
</script>

<template>
  <n-message-provider>
    <n-grid x-gap="12" :cols="8">
      <n-gi span="1"></n-gi>
      <n-gi span="6">
        <div class="main">
          <n-space vertical>
            <h2>Cloudflare Temp Email <n-button tag="a" target="_blank" tertiary type="primary" round class="button-left"
                href="https://github.com/dreamhunter2333/cloudflare_temp_email">Star Github</n-button>
            </h2>
            <Content />
          </n-space>
        </div>
      </n-gi>
      <n-gi span="1"></n-gi>
    </n-grid>
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

.button-left {
  margin-left: 10px;
}
</style>
