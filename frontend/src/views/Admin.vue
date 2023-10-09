<script setup>
import { NSpace, NLayoutHeader, NInput, c } from 'naive-ui'
import { NButton, NSelect, NModal } from 'naive-ui'
import { NDataTable, NPopconfirm } from 'naive-ui'
import { ref, h, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'

import { useGlobalState } from '../store'
import { api } from '../api'

const { localeCache, adminAuth, showAdminAuth } = useGlobalState()
const router = useRouter()
const message = useMessage()

const showEmailPassword = ref(false)
const curEmailPassword = ref("")

const authFunc = async () => {
  try {
    location.reload()
  } catch (error) {
    message.error(error.message || "error");
  }
}

const { t } = useI18n({
  locale: localeCache.value || 'zh',
  messages: {
    en: {
      title: 'Temp Email Admin',
      auth: 'Admin Auth',
      home: 'Home',
      authTip: 'Please enter the correct auth code',
      name: 'Name',
      created_at: 'Created At',
      showPass: 'Show Passwrod',
      password: 'Password',
      passwordTip: 'Please copy the password and you can use it to login to your email account.',
      delete: 'Delete',
      deleteTip: 'Are you sure to delete this email?',
      refresh: 'Refresh',
    },
    zh: {
      title: '临时邮件 Admin',
      auth: 'Admin 授权',
      home: '首页',
      authTip: '请输入正确的授权码',
      name: '名称',
      created_at: '创建时间',
      showPass: '显示密码',
      password: '密码',
      passwordTip: '请复制密码，你可以使用它登录你的邮箱。',
      delete: '删除',
      deleteTip: '确定要删除这个邮箱吗？',
      refresh: '刷新',
    }
  }
});
const data = ref([])

const showPassword = async (id) => {
  try {
    curEmailPassword.value = await api.adminShowPassword(id)
    showEmailPassword.value = true
  } catch (error) {
    message.error(error.message || "error");
    showEmailPassword.value = false
    curEmailPassword.value = ""
  }
}

const deleteEmail = async (id) => {
  try {
    await api.adminDeleteAddress(id)
    message.success("success");
    await fetchData()
  } catch (error) {
    message.error(error.message || "error");
  }
}

const fetchData = async () => {
  try {
    data.value = await api.adminGetAddress()
  } catch (error) {
    console.log(error)
    message.error(error.message || "error");
  }
}

const columns = [
  {
    title: "ID",
    key: "id"
  },
  {
    title: t('name'),
    key: "name"
  },
  {
    title: t('created_at'),
    key: "created_at"
  },
  {
    title: 'Action',
    key: 'actions',
    render(row) {
      return h('div', [
        h(NButton,
          {
            type: 'success',
            onClick: () => showPassword(row.id)
          },
          { default: () => t('showPass') }
        ),
        h(NPopconfirm,
          {
            onPositiveClick: () => deleteEmail(row.id)
          },
          {
            trigger: () => h(NButton, { type: "error" }, () => t('delete')),
            default: () => t('deleteTip')
          }
        )
      ])
    }
  }
]


onMounted(async () => {
  if (!adminAuth.value) {
    showAdminAuth.value = true
  } else {
    await fetchData()
  }
})
</script>

<template>
  <n-space vertical>

    <n-layout-header>
      <div>
        <h2>{{ t('title') }}</h2>
      </div>
      <div>
        <n-button tertiary @click="() => router.push('/')" type="primary">
          {{ t('home') }}
        </n-button>
        <n-button tertiary @click="fetchData" type="primary">
          {{ t('refresh') }}
        </n-button>
      </div>
      <n-modal v-model:show="showAdminAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
        title="Dialog">
        <template #header>
          <div>{{ t('auth') }}</div>
        </template>
        <p>{{ t('authTip') }}</p>
        <n-input v-model:value="adminAuth" type="textarea" :autosize="{
          minRows: 3
        }" />
        <template #action>
          <n-button @click="authFunc" size="small" tertiary round type="primary">
            {{ t('auth') }}
          </n-button>
        </template>
      </n-modal>
      <n-modal v-model:show="showEmailPassword" preset="dialog" title="Dialog">
        <template #header>
          <div>{{ t("password") }}</div>
        </template>
        <span>
          <p>{{ t("passwordTip") }}</p>
        </span>
        <n-card>
          <b>{{ curEmailPassword }}</b>
        </n-card>
        <template #action>
        </template>
      </n-modal>
    </n-layout-header>
    <n-data-table :columns="columns" :data="data" :bordered="false" />
  </n-space>
</template>

<style scoped>
.n-layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
