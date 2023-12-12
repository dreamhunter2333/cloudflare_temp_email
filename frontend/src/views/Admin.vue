<script setup>
import { NSpace, NLayoutHeader, NInput, NPagination } from 'naive-ui'
import { NButton, NModal, NTabs, NTabPane, NInputGroup } from 'naive-ui'
import { NList, NListItem, NThing, NTag } from 'naive-ui'
import { NDataTable, NPopconfirm } from 'naive-ui'
import { ref, h, onMounted, watch } from 'vue';
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
      emails: 'Emails',
      itemCount: 'itemCount',
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
      emails: '邮件',
      itemCount: '总数',
    }
  }
});
const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

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
    const { results, count: addressCount } = await api.fetch(
      `/admin/address`
      + `?limit=${pageSize.value}`
      + `&offset=${(page.value - 1) * pageSize.value}`
    );
    data.value = results;
    if (addressCount > 0) {
      count.value = addressCount;
    }
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
        h(NButton,
          {
            type: 'success',
            onClick: () => {
              mailAddress.value = row.name
              tab.value = "mails"
            }
          },
          { default: () => t('emails') }
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

watch([page, pageSize], async () => {
  await fetchData()
})


onMounted(async () => {
  if (!adminAuth.value) {
    showAdminAuth.value = true
  } else {
    await fetchData()
  }
})

const tab = ref("account")
const mailAddress = ref("")
const mailData = ref([])
const mailCount = ref(0)
const mailPage = ref(1)
const mailPageSize = ref(20)

watch([mailPage, mailPageSize, mailAddress], async () => {
  await fetchMailData()
})

const fetchMailData = async () => {
  if (!mailAddress.value) {
    return
  }
  try {
    const { results, count } = await api.fetch(
      `/admin/mails`
      + `?address=${mailAddress.value}`
      + `&limit=${mailPageSize.value}`
      + `&offset=${(mailPage.value - 1) * mailPageSize.value}`
    );
    mailData.value = results;
    if (count > 0) {
      mailCount.value = count;
    }
  } catch (error) {
    console.log(error)
    message.error(error.message || "error");
  }
}


const mailUnknowData = ref([])
const mailUnknowCount = ref(0)
const mailUnknowPage = ref(1)
const mailUnknowPageSize = ref(20)

watch([mailUnknowPage, mailUnknowPageSize], async () => {
  await fetchMailUnknowData()
})

const fetchMailUnknowData = async () => {
  try {
    const { results, count } = await api.fetch(
      `/admin/mails_unknow`
      + `?limit=${mailPageSize.value}`
      + `&offset=${(mailPage.value - 1) * mailPageSize.value}`
    );
    mailUnknowData.value = results;
    if (count > 0) {
      mailUnknowCount.value = count;
    }
  } catch (error) {
    console.log(error)
    message.error(error.message || "error");
  }
}
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
    <n-tabs type="segment" v-model:value="tab">
      <n-tab-pane name="account" tab="account">
        <div style="display: inline-block;">
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" :page-sizes="[20, 50, 100]"
            show-size-picker>
            <template #prefix="{ itemCount }">
              {{ t('itemCount') }}: {{ itemCount }}
            </template>
          </n-pagination>
        </div>
        <n-button tertiary @click="fetchData" type="primary">
          {{ t('refresh') }}
        </n-button>
        <n-data-table :columns="columns" :data="data" :bordered="false" />
      </n-tab-pane>
      <n-tab-pane name="mails" tab="mails">
        <n-input-group>
          <n-input v-model:value="mailAddress" />
          <n-button @click="fetchMailData" type="primary" ghost>
            {{ t('refresh') }}
          </n-button>
        </n-input-group>
        <n-list hoverable clickable>
          <div style="display: inline-block; margin-bottom: 10px;">
            <n-pagination v-model:page="mailPage" v-model:page-size="mailPageSize" :item-count="mailCount" simple>
              <template #prefix="{ itemCount }">
                {{ t('itemCount') }}: {{ itemCount }}
              </template>
            </n-pagination>
          </div>
          <n-list-item v-for="row in mailData" v-bind:key="row.id">
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
      </n-tab-pane>
      <n-tab-pane name="unknow" tab="unknown">
        <n-button @click="fetchMailUnknowData" type="primary" ghost>
          {{ t('refresh') }}
        </n-button>
        <n-list hoverable clickable>
          <div style="display: inline-block; margin-bottom: 10px;">
            <n-pagination v-model:page="mailUnknowPage" v-model:page-size="mailUnknowPageSize"
              :item-count="mailUnknowCount" simple>
              <template #prefix="{ itemCount }">
                {{ t('itemCount') }}: {{ itemCount }}
              </template>
            </n-pagination>
          </div>
          <n-list-item v-for="row in mailUnknowData" v-bind:key="row.id">
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
      </n-tab-pane>
    </n-tabs>
  </n-space>
</template>

<style scoped>
.n-layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.n-pagination {
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
