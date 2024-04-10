<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { User, UserCheck, MailBulk } from '@vicons/fa'

import { useGlobalState } from '../store'
import { api } from '../api'
import { processItem } from '../utils/email-parser'
import SenderAccess from './admin/SenderAccess.vue'

const { localeCache, adminAuth, showAdminAuth } = useGlobalState()
const router = useRouter()
const message = useMessage()

const showEmailPassword = ref(false)
const curEmailPassword = ref("")
const addressQuery = ref("")

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
      mails: 'Emails',
      itemCount: 'itemCount',
      query: 'Query',
      userCount: 'User Count',
      activeUser: '7 days Active User',
      mailCount: 'Mail Count',
      account: 'Account',
      unknow: 'Unknow',
      addressQueryTip: 'Leave blank to query all addresses',
      senderAccess: 'Sender Access Control',
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
      mails: '邮件',
      itemCount: '总数',
      query: '查询',
      userCount: '用户总数',
      activeUser: '周活跃用户',
      mailCount: '邮件总数',
      account: '账号',
      unknow: '未知',
      addressQueryTip: '留空查询所有地址',
      senderAccess: '发件权限控制',
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
      + (addressQuery.value ? `&query=${addressQuery.value}` : "")
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
            ghost: true,
            onClick: () => showPassword(row.id)
          },
          { default: () => t('showPass') }
        ),
        h(NButton,
          {
            type: 'success',
            ghost: true,
            onClick: () => {
              mailAddress.value = row.name
              tab.value = "mails"
            }
          },
          { default: () => t('mails') }
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

const statistics = ref({
  userCount: 0,
  mailCount: 0,
  activeUserCount7days: 0,
})

const fetchStatistics = async () => {
  try {
    const { userCount, activeUserCount7days, mailCount } = await api.fetch(`/admin/statistics`);
    statistics.value.mailCount = mailCount || 0;
    statistics.value.userCount = userCount || 0;
    statistics.value.activeUserCount7days = activeUserCount7days || 0;
  } catch (error) {
    console.log(error)
    message.error(error.message || "error");
  }
}

onMounted(async () => {
  if (!adminAuth.value) {
    showAdminAuth.value = true
  } else {
    await fetchData()
    await fetchStatistics()
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
    mailData.value = await Promise.all(results.map(async (item) => {
      return await processItem(item);
    }));
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
    mailUnknowData.value = await Promise.all(results.map(async (item) => {
      return await processItem(item);
    }));
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
  <div>
    <n-modal v-model:show="showAdminAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
      title="Dialog">
      <template #header>
        <div>{{ t('auth') }}</div>
      </template>
      <p>{{ t('authTip') }}</p>
      <n-input v-model:value="adminAuth" type="textarea" :autosize="{ minRows: 3 }" />
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
    <n-row>
      <n-col :span="8">
        <n-statistic :label="t('userCount')" :value="statistics.userCount">
          <template #prefix>
            <n-icon :component="User" />
          </template>
        </n-statistic>
      </n-col>
      <n-col :span="8">
        <n-statistic :label="t('activeUser')" :value="statistics.activeUserCount7days">
          <template #prefix>
            <n-icon :component="UserCheck" />
          </template>
        </n-statistic>
      </n-col>
      <n-col :span="8">
        <n-statistic :label="t('mailCount')" :value="statistics.mailCount">
          <template #prefix>
            <n-icon :component="MailBulk" />
          </template>
        </n-statistic>
      </n-col>
    </n-row>
    <n-tabs type="segment" v-model:value="tab">
      <n-tab-pane name="account" :tab="t('account')">
        <n-input-group>
          <n-input v-model:value="addressQuery" clearable :placeholder="t('addressQueryTip')" />
          <n-button @click="fetchData" type="primary" ghost>
            {{ t('query') }}
          </n-button>
        </n-input-group>
        <div style="display: inline-block;">
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" :page-sizes="[20, 50, 100]"
            show-size-picker>
            <template #prefix="{ itemCount }">
              {{ t('itemCount') }}: {{ itemCount }}
            </template>
          </n-pagination>
        </div>
        <n-data-table :columns="columns" :data="data" :bordered="false" />
      </n-tab-pane>
      <n-tab-pane name="mails" :tab="t('mails')">
        <n-input-group>
          <n-input v-model:value="mailAddress" />
          <n-button @click="fetchMailData" type="primary" ghost>
            {{ t('query') }}
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
      <n-tab-pane name="unknow" :tab="t('unknow')">
        <n-button @click="fetchMailUnknowData" type="primary" ghost>
          {{ t('query') }}
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
      <n-tab-pane name="senderAccess" :tab="t('senderAccess')">
        <SenderAccess />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<style scoped>
.n-pagination {
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
